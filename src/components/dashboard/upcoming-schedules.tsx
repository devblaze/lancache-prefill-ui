import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Clock, Repeat } from "lucide-react";

interface UpcomingSchedulesProps {
  schedules: Array<{
    id: string;
    name: string | null;
    type: string;
    nextRunAt: string | null;
    tool: {
      displayName: string;
    };
    games: Array<{ id: string }>;
  }>;
}

export function UpcomingSchedules({ schedules }: UpcomingSchedulesProps) {
  if (schedules.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Upcoming Schedules</h2>
        <Link
          href="/schedules"
          className="text-sm text-blue-600 hover:underline"
        >
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {schedules.map((schedule) => (
          <Link
            key={schedule.id}
            href="/schedules"
            className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 transition-colors hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <div className="flex items-center gap-3">
              {schedule.type === "recurring" ? (
                <Repeat className="h-4 w-4 text-blue-500" />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {schedule.name ||
                    `${schedule.tool.displayName} — ${schedule.games.length} game${schedule.games.length !== 1 ? "s" : ""}`}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {schedule.tool.displayName}
                </p>
              </div>
            </div>
            {schedule.nextRunAt && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDistanceToNow(new Date(schedule.nextRunAt), {
                  addSuffix: true,
                })}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
