"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Ban,
  RefreshCw,
} from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  completed: {
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
    color: "text-green-600",
  },
  failed: {
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    color: "text-red-600",
  },
  running: {
    icon: <Loader2 className="h-5 w-5 animate-spin text-blue-600" />,
    color: "text-blue-600",
  },
  pending: {
    icon: <Clock className="h-5 w-5 text-yellow-600" />,
    color: "text-yellow-600",
  },
  cancelled: {
    icon: <Ban className="h-5 w-5 text-zinc-500" />,
    color: "text-zinc-500",
  },
};

export function JobsList() {
  const { jobs, loading, cancelJob, refetch } = useJobs();

  if (loading) {
    return (
      <div className="py-12 text-center text-zinc-500">Loading jobs...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={refetch}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500">
            No prefill jobs yet. Go to the Games page to start one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const config = statusConfig[job.status] || statusConfig.pending;
            return (
              <div
                key={job.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    {config.icon}
                    <div>
                      <p className="font-medium">{job.tool.displayName}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {job.games.length} game
                        {job.games.length !== 1 && "s"} &middot;{" "}
                        {formatDistanceToNow(new Date(job.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm capitalize ${config.color}`}>
                      {job.status}
                    </span>
                    {job.status === "running" && (
                      <button
                        onClick={() => cancelJob(job.id)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Game names preview */}
                {job.games.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.games.slice(0, 5).map((jg) => (
                      <span
                        key={jg.id}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                      >
                        {jg.game.name}
                      </span>
                    ))}
                    {job.games.length > 5 && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                        +{job.games.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
