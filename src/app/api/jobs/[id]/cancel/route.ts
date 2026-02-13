import { NextRequest, NextResponse } from "next/server";
import { JobManager } from "@/lib/prefill-service";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobManager = JobManager.getInstance();

    // Try to cancel the in-memory job (sends abort signal, etc.)
    const inMemoryJob = jobManager.getJob(id);
    if (inMemoryJob) {
      await jobManager.cancelJob(id);
    } else {
      // Job not in memory (server restart, HMR, or pending job that never started).
      // Update the DB directly.
      await prisma.prefillJob.update({
        where: { id },
        data: {
          status: "cancelled",
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}
