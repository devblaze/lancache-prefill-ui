"use client";

import { useState } from "react";
import { X, Play, Clock, Repeat } from "lucide-react";

type RunMode = "now" | "once" | "recurring";

interface ScheduleConfig {
  type: "one-time" | "recurring";
  scheduledAt?: string;
  cronExpression?: string;
}

interface PrefillDialogProps {
  gameIds: string[];
  tools: Array<{ id: string; displayName: string }>;
  selectedToolId: string | null;
  defaultScheduleTime?: string;
  onClose: () => void;
  onSubmit: (
    toolId: string,
    flags: { force: boolean; verbose: boolean },
    scheduleConfig?: ScheduleConfig
  ) => void;
  loading: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCron(time: string, days: number[]): string {
  const [h, m] = time.split(":").map(Number);
  if (days.length === 0 || days.length === 7) return `${m} ${h} * * *`;
  return `${m} ${h} * * ${days.join(",")}`;
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function PrefillDialog({
  gameIds,
  tools,
  selectedToolId,
  defaultScheduleTime = "01:00",
  onClose,
  onSubmit,
  loading,
}: PrefillDialogProps) {
  const [toolId, setToolId] = useState(selectedToolId || "");
  const [force, setForce] = useState(false);
  const [verbose, setVerbose] = useState(false);

  // Schedule state
  const [runMode, setRunMode] = useState<RunMode>("now");
  const [scheduleDate, setScheduleDate] = useState(getTomorrowDate());
  const [scheduleTime, setScheduleTime] = useState(defaultScheduleTime);
  const [recurringTime, setRecurringTime] = useState(defaultScheduleTime);
  const [frequency, setFrequency] = useState<"daily" | "specific">("daily");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolId) return;

    const flags = { force, verbose };

    if (runMode === "now") {
      onSubmit(toolId, flags);
    } else if (runMode === "once") {
      const scheduledAt = new Date(
        `${scheduleDate}T${scheduleTime}:00`
      ).toISOString();
      onSubmit(toolId, flags, { type: "one-time", scheduledAt });
    } else if (runMode === "recurring") {
      const days = frequency === "daily" ? [] : selectedDays;
      const cronExpression = buildCron(recurringTime, days);
      onSubmit(toolId, flags, { type: "recurring", cronExpression });
    }
  };

  const modeOptions: Array<{ value: RunMode; label: string; icon: React.ReactNode }> = [
    { value: "now", label: "Run Now", icon: <Play className="h-4 w-4" /> },
    { value: "once", label: "Schedule Once", icon: <Clock className="h-4 w-4" /> },
    { value: "recurring", label: "Recurring", icon: <Repeat className="h-4 w-4" /> },
  ];

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Prefill Job</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {gameIds.length} game{gameIds.length !== 1 && "s"} selected for
          prefill
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Platform Tool
            </label>
            <select
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select a tool...</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Force re-download (--force)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={verbose}
                onChange={(e) => setVerbose(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Verbose output (--verbose)</span>
            </label>
          </div>

          {/* Run Mode */}
          <div>
            <label className="mb-2 block text-sm font-medium">Run Mode</label>
            <div className="flex gap-2">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRunMode(opt.value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    runMode === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Once Options */}
          {runMode === "once" && (
            <div className="space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Recurring Options */}
          {runMode === "recurring" && (
            <div className="space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Frequency
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFrequency("daily");
                      setSelectedDays([]);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      frequency === "daily"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency("specific")}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      frequency === "specific"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    Specific Days
                  </button>
                </div>
              </div>

              {frequency === "specific" && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Days</label>
                  <div className="flex gap-1">
                    {DAY_LABELS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selectedDays.includes(i)
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Time</label>
                <input
                  type="time"
                  value={recurringTime}
                  onChange={(e) => setRecurringTime(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !toolId}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Working..."
                : runMode === "now"
                  ? "Start Prefill"
                  : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
