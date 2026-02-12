import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Clock, Loader2, Ban } from "lucide-react";

interface RecentJobsProps {
  jobs: Array<{
    id: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
    tool: {
      displayName: string;
    };
    games: Array<{ game: { name: string } }>;
  }>;
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
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

export function RecentJobs({ jobs }: RecentJobsProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recent Jobs</h2>
        <Link
          href="/jobs"
          className="text-sm text-blue-600 hover:underline"
        >
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">
            No jobs yet. Start a prefill to see it here.
          </p>
        ) : (
          jobs.map((job) => {
            const config = statusConfig[job.status] || statusConfig.pending;
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-lg bg-zinc-50 p-4 transition-colors hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {config.icon}
                    <div>
                      <p className="font-medium">
                        {job.games.slice(0, 3).map((g) => g.game.name).join(", ")}
                        {job.games.length > 3 && ` +${job.games.length - 3} more`}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {job.tool.displayName} &middot;{" "}
                        {formatDistanceToNow(new Date(job.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm capitalize ${config.color}`}>
                    {job.status}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
