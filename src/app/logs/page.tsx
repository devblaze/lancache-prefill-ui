"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, RefreshCw, Pause, Play, ChevronRight } from "lucide-react";
import type { AppLogEntry, LogLevel } from "@/lib/app-logger";

const levelColors: Record<LogLevel, string> = {
  debug: "text-zinc-400",
  info: "text-blue-500",
  warn: "text-yellow-500",
  error: "text-red-500",
};

const levelBgColors: Record<LogLevel, string> = {
  debug: "bg-zinc-100 dark:bg-zinc-800",
  info: "bg-blue-100 dark:bg-blue-900",
  warn: "bg-yellow-100 dark:bg-yellow-900",
  error: "bg-red-100 dark:bg-red-900",
};

function LogRow({ log }: { log: AppLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!log.details;

  return (
    <div
      className={`rounded ${
        log.level === "error"
          ? "bg-red-950/30"
          : log.level === "warn"
            ? "bg-yellow-950/20"
            : ""
      }`}
    >
      <div
        className={`flex items-start gap-3 px-2 py-1 ${hasDetails ? "cursor-pointer hover:bg-white/5" : ""}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <span className="mt-0.5 shrink-0 w-4">
          {hasDetails && (
            <ChevronRight
              className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          )}
        </span>
        <span className="shrink-0 text-zinc-500">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <span
          className={`w-12 shrink-0 text-right font-semibold uppercase ${levelColors[log.level]}`}
        >
          {log.level}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 text-xs leading-5 ${levelBgColors[log.level]}`}
        >
          {log.source}
        </span>
        <span className="text-zinc-200 break-all">{log.message}</span>
      </div>
      {expanded && log.details && (
        <div className="ml-[6.5rem] border-l-2 border-zinc-700 px-3 py-2 mb-1">
          <pre className="whitespace-pre-wrap text-xs text-zinc-400">
            {log.details}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lastIdRef.current > 0) {
        params.set("since", String(lastIdRef.current));
      }
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.logs.length > 0) {
        setLogs((prev) => {
          const map = new Map(prev.map((l: AppLogEntry) => [l.id, l]));
          for (const log of data.logs) {
            map.set(log.id, log);
          }
          return Array.from(map.values()).slice(-500);
        });
        lastIdRef.current = data.logs[data.logs.length - 1].id;
      }
    } catch {
      // Ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoRefresh]);

  const clearLogs = async () => {
    await fetch("/api/logs", { method: "DELETE" });
    setLogs([]);
    lastIdRef.current = 0;
  };

  const sources = Array.from(new Set(logs.map((l) => l.source)));

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== "all" && log.level !== filterLevel) return false;
    if (filterSource !== "all" && log.source !== filterSource) return false;
    return true;
  });

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-3xl font-bold">Logs</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {logs.length} entries
            {errorCount > 0 && (
              <span className="ml-2 text-red-500">{errorCount} errors</span>
            )}
            {warnCount > 0 && (
              <span className="ml-2 text-yellow-500">
                {warnCount} warnings
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              autoRefresh
                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300"
                : "border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {autoRefresh ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {autoRefresh ? "Pause" : "Resume"}
          </button>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 pb-3">
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-950 font-mono text-sm dark:border-zinc-800">
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            No log entries yet. Logs will appear as the application processes
            requests.
          </div>
        ) : (
          <div className="p-3 space-y-0.5">
            {filteredLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
