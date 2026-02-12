import { NextRequest } from "next/server";
import { JobManager } from "@/lib/prefill-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobManager = JobManager.getInstance();
  const job = jobManager.getJob(id);

  if (!job) {
    return new Response("Job not found or not running", { status: 404 });
  }

  const encoder = new TextEncoder();
  const activeJob = job;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream may be closed
        }
      };

      const onProgress = (data: unknown) => sendEvent("progress", data);
      const onLog = (data: unknown) => sendEvent("log", data);
      const onGameComplete = (data: unknown) => sendEvent("game-complete", data);
      const onGameError = (data: unknown) => sendEvent("game-error", data);
      const onComplete = (data: unknown) => {
        sendEvent("complete", data);
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };
      const onError = (data: unknown) => {
        sendEvent("error", data);
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      function cleanup() {
        activeJob.off("progress", onProgress);
        activeJob.off("log", onLog);
        activeJob.off("game-complete", onGameComplete);
        activeJob.off("game-error", onGameError);
        activeJob.off("complete", onComplete);
        activeJob.off("error", onError);
      }

      activeJob.on("progress", onProgress);
      activeJob.on("log", onLog);
      activeJob.on("game-complete", onGameComplete);
      activeJob.on("game-error", onGameError);
      activeJob.on("complete", onComplete);
      activeJob.on("error", onError);

      // Send initial connected event
      sendEvent("connected", { jobId: id });

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
