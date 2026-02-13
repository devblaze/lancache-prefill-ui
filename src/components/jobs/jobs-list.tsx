"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Ban,
  RefreshCw,
  Gamepad2,
  CalendarClock,
} from "lucide-react";
import { useJobs } from "@/hooks/use-jobs";
import { getGameImageUrl } from "@/lib/image-url";

function GameThumbnail({ appId, name, isSteam }: { appId: string; name: string; isSteam: boolean }) {
  const [imgError, setImgError] = useState(false);

  if (isSteam && !imgError) {
    return (
      <Image
        src={getGameImageUrl(appId, isSteam ? "Steam" : "")}
        alt={name}
        width={120}
        height={56}
        className="rounded object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="flex h-14 w-[120px] items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
      <Gamepad2 className="h-6 w-6 text-zinc-400 dark:text-zinc-600" />
    </div>
  );
}

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
            const isSteam = job.tool.displayName === "Steam";
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
              >
                {/* Header: status + platform + time + cancel */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <span className={`text-sm capitalize ${config.color}`}>
                      {job.status}
                    </span>
                    <span className="text-sm text-zinc-400">&middot;</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {job.tool.displayName}
                    </span>
                    <span className="text-sm text-zinc-400">&middot;</span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatDistanceToNow(new Date(job.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {job.schedule && (
                      <>
                        <span className="text-sm text-zinc-400">&middot;</span>
                        <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                          <CalendarClock className="h-3 w-3" />
                          Scheduled
                        </span>
                      </>
                    )}
                  </div>
                  {(job.status === "running" || job.status === "pending") && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        cancelJob(job.id);
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/* Games with thumbnails */}
                {job.games.length > 0 && (
                  <div className="space-y-2">
                    {job.games.slice(0, 4).map((jg) => (
                      <div key={jg.id} className="flex items-center gap-3">
                        <GameThumbnail
                          appId={jg.game.appId}
                          name={jg.game.name}
                          isSteam={isSteam}
                        />
                        <p className="font-medium">{jg.game.name}</p>
                      </div>
                    ))}
                    {job.games.length > 4 && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        +{job.games.length - 4} more game
                        {job.games.length - 4 !== 1 && "s"}
                      </p>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
