"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSSE } from "@/hooks/use-sse";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Loader2, Ban } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface JobGame {
  id: string;
  status: string;
  progress: number;
  sizeBytes: string | null;
  downloadedBytes: string;
  game: {
    id: string;
    name: string;
    appId: string;
  };
}

interface JobLog {
  id: string;
  message: string;
  level: string;
  timestamp: string;
}

interface JobDetailsProps {
  job: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    errorMessage: string | null;
    tool: { displayName: string };
    games: JobGame[];
    logs: JobLog[];
  };
}

export function JobDetails({ job: initialJob }: JobDetailsProps) {
  const router = useRouter();
  const isRunning = initialJob.status === "running";
  const { messages } = useSSE(
    isRunning ? `/api/jobs/${initialJob.id}/events` : null
  );

  // Derive progress, game statuses, and logs from SSE messages
  const gameProgress = useMemo(() => {
    const progress: Record<string, { percent: number; downloaded: number; total: number; speed: string }> = {};
    for (const msg of messages) {
      if (msg.event === "progress") {
        const data = msg.data as { appId?: string; progress?: number; downloadedBytes?: number; totalBytes?: number; speed?: string };
        const appId = data.appId;
        if (appId && data.progress !== undefined) {
          progress[appId] = {
            percent: data.progress,
            downloaded: data.downloadedBytes ?? 0,
            total: data.totalBytes ?? 0,
            speed: data.speed ?? "",
          };
        }
      }
    }
    return progress;
  }, [messages]);

  const gameStatuses = useMemo(() => {
    const statuses: Record<string, string> = {};
    let jobDone = false;
    for (const msg of messages) {
      if (msg.event === "game-complete") {
        const data = msg.data as { appId?: string };
        if (data.appId) statuses[data.appId] = "completed";
      } else if (msg.event === "game-error") {
        const data = msg.data as { appId?: string };
        if (data.appId) statuses[data.appId] = "failed";
      } else if (msg.event === "complete" || msg.event === "error") {
        jobDone = true;
      }
    }
    if (jobDone) {
      router.refresh();
    }
    return statuses;
  }, [messages, router]);

  const liveLogs = useMemo(() => {
    const logs: Array<{ message: string; level: string }> = [];
    for (const msg of messages) {
      if (msg.event === "log") {
        const data = msg.data as { message: string; level: string };
        logs.push(data);
      }
    }
    return logs.slice(-200);
  }, [messages]);

  const handleCancel = async () => {
    await fetch(`/api/jobs/${initialJob.id}/cancel`, { method: "POST" });
    router.refresh();
  };

  const gameStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "downloading":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case "cancelled":
        return <Ban className="h-5 w-5 text-zinc-500" />;
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Job Summary */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Status</p>
            <p className="text-lg font-semibold capitalize">
              {initialJob.status}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Started</p>
            <p className="text-lg font-semibold">
              {initialJob.startedAt
                ? formatDistanceToNow(new Date(initialJob.startedAt), {
                    addSuffix: true,
                  })
                : "Not started"}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Platform
            </p>
            <p className="text-lg font-semibold">
              {initialJob.tool.displayName}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Games</p>
            <p className="text-lg font-semibold">{initialJob.games.length}</p>
          </div>
        </div>

        {initialJob.errorMessage && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {initialJob.errorMessage}
          </div>
        )}

        {(isRunning || initialJob.status === "pending") && (
          <div className="mt-4">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              Cancel Job
            </button>
          </div>
        )}
      </div>

      {/* Game Progress */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-semibold">Games</h2>
        <div className="space-y-3">
          {initialJob.games.map((jobGame) => {
            const liveProgress = gameProgress[jobGame.game.appId];
            const percent = liveProgress?.percent ?? jobGame.progress;
            const status = gameStatuses[jobGame.game.appId] ?? jobGame.status;
            const showProgress = status === "downloading" || percent > 0;
            return (
              <div
                key={jobGame.id}
                className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {gameStatusIcon(status)}
                    <div>
                      <p className="font-medium">{jobGame.game.name}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {liveProgress && liveProgress.total > 0
                          ? `${formatBytes(BigInt(Math.round(liveProgress.downloaded)))} / ${formatBytes(BigInt(Math.round(liveProgress.total)))}`
                          : jobGame.sizeBytes
                            ? formatBytes(BigInt(jobGame.sizeBytes))
                            : null}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm capitalize">{status}</span>
                    {liveProgress?.speed && status === "downloading" && (
                      <p className="text-xs text-zinc-500">{liveProgress.speed}</p>
                    )}
                  </div>
                </div>
                {showProgress && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className="h-2 rounded-full bg-blue-600 transition-all"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Logs */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-semibold">Logs</h2>
        <div className="max-h-96 overflow-y-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-green-400">
          {initialJob.logs.length === 0 && liveLogs.length === 0 ? (
            <p className="text-zinc-500">No logs yet.</p>
          ) : (
            <>
              {initialJob.logs.map((log) => (
                <div
                  key={log.id}
                  className={
                    log.level === "error" ? "text-red-400" : undefined
                  }
                >
                  [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                </div>
              ))}
              {liveLogs.map((log, i) => (
                <div
                  key={`live-${i}`}
                  className={
                    log.level === "error" ? "text-red-400" : undefined
                  }
                >
                  [{new Date().toLocaleTimeString()}] {log.message}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
