"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import {
  Clock,
  Repeat,
  Trash2,
  Play,
  Gamepad2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { getGameImageUrl } from "@/lib/image-url";

interface ScheduleGame {
  id: string;
  game: {
    id: string;
    appId: string;
    name: string;
    toolId: string;
  };
}

interface Schedule {
  id: string;
  name: string | null;
  toolId: string;
  type: string;
  cronExpression: string | null;
  scheduledAt: string | null;
  flags: string | null;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  tool: {
    id: string;
    displayName: string;
  };
  games: ScheduleGame[];
  jobs: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
}

function GamePill({
  game,
  isSteam,
}: {
  game: ScheduleGame["game"];
  isSteam: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
      {isSteam && !imgError ? (
        <Image
          src={getGameImageUrl(game.appId, isSteam ? "Steam" : "")}
          alt={game.name}
          width={40}
          height={18}
          className="rounded object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <Gamepad2 className="h-4 w-4 text-zinc-400" />
      )}
      <span className="text-sm">{game.name}</span>
    </div>
  );
}

function describeCron(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;

  const [min, hour, , , dayOfWeek] = parts;
  const time = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;

  if (dayOfWeek === "*") {
    return `Daily at ${time}`;
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = dayOfWeek
    .split(",")
    .map((d) => dayNames[parseInt(d)] || d)
    .join(", ");

  return `${days} at ${time}`;
}

interface SchedulesListProps {
  initialSchedules: Schedule[];
}

export function SchedulesList({ initialSchedules }: SchedulesListProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState(initialSchedules);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const toggleEnabled = async (schedule: Schedule) => {
    setActionLoading(schedule.id);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !schedule.isEnabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? { ...s, ...updated } : s))
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  const deleteSchedule = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const runNow = async (schedule: Schedule) => {
    setActionLoading(schedule.id);
    try {
      const flags = schedule.flags ? JSON.parse(schedule.flags) : {};
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: schedule.toolId,
          gameIds: schedule.games.map((sg) => sg.game.id),
          flags,
        }),
      });
      if (res.ok) {
        const job = await res.json();
        router.push(`/jobs/${job.id}`);
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <Clock className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
        <p className="text-zinc-500">
          No schedules yet. Select games from the Game Library and choose
          &quot;Schedule Once&quot; or &quot;Recurring&quot; to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => {
        const isSteam = schedule.tool.displayName === "Steam";
        const isLoading = actionLoading === schedule.id;
        const scheduleName =
          schedule.name ||
          `${schedule.tool.displayName} — ${schedule.games.length} game${schedule.games.length !== 1 ? "s" : ""}`;

        return (
          <div
            key={schedule.id}
            className={`rounded-lg border bg-white p-5 transition-colors dark:bg-zinc-900 ${
              schedule.isEnabled
                ? "border-zinc-200 dark:border-zinc-800"
                : "border-zinc-200 opacity-60 dark:border-zinc-800"
            }`}
          >
            {/* Header */}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {schedule.type === "recurring" ? (
                    <Repeat className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500" />
                  )}
                  <h3 className="font-semibold">{scheduleName}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      schedule.type === "recurring"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    }`}
                  >
                    {schedule.type === "recurring" ? "Recurring" : "One-time"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {schedule.type === "recurring" && schedule.cronExpression
                    ? describeCron(schedule.cronExpression)
                    : schedule.scheduledAt
                      ? format(new Date(schedule.scheduledAt), "PPP 'at' p")
                      : "No schedule set"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEnabled(schedule)}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title={schedule.isEnabled ? "Disable" : "Enable"}
                >
                  {schedule.isEnabled ? (
                    <ToggleRight className="h-5 w-5 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-zinc-400" />
                  )}
                </button>
                <button
                  onClick={() => runNow(schedule)}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Run now"
                >
                  <Play className="h-4 w-4 text-blue-500" />
                </button>
                <button
                  onClick={() => deleteSchedule(schedule.id)}
                  disabled={isLoading}
                  className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Delete schedule"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>

            {/* Schedule meta */}
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {schedule.nextRunAt && (
                <span>
                  Next run:{" "}
                  {formatDistanceToNow(new Date(schedule.nextRunAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
              {schedule.lastRunAt && (
                <span>
                  Last run:{" "}
                  {formatDistanceToNow(new Date(schedule.lastRunAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
              {schedule.jobs.length > 0 && (
                <span>
                  Last job: {schedule.jobs[0].status}
                </span>
              )}
            </div>

            {/* Games */}
            <div className="flex flex-wrap gap-2">
              {schedule.games.slice(0, 5).map((sg) => (
                <GamePill key={sg.id} game={sg.game} isSteam={isSteam} />
              ))}
              {schedule.games.length > 5 && (
                <span className="flex items-center text-sm text-zinc-500">
                  +{schedule.games.length - 5} more
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
