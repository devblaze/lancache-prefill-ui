"use client";

import { useState, useEffect, useCallback } from "react";
import { HardDrive, CheckCircle, Download, RefreshCw } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface CacheStats {
  totalSize: number;
  cachedGames: number;
  totalGames: number;
  cacheByTool: Record<string, number>;
  cacheUnavailable?: boolean;
}

export function DashboardStats() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cache/stats");
      if (!res.ok) {
        setError("Failed to fetch cache stats");
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cachePercentage =
    stats && stats.totalGames > 0
      ? ((stats.cachedGames / stats.totalGames) * 100).toFixed(1)
      : "0";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cache Overview</h2>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
              <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Cache Size
              </p>
              <p className="text-2xl font-bold">
                {loading ? (
                  <span className="text-zinc-400">Loading...</span>
                ) : stats?.cacheUnavailable ? (
                  <span className="text-zinc-400">Unavailable</span>
                ) : stats ? (
                  formatBytes(stats.totalSize)
                ) : (
                  <span className="text-zinc-400">--</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Cached Games
              </p>
              {loading ? (
                <p className="text-2xl font-bold text-zinc-400">Loading...</p>
              ) : stats ? (
                <>
                  <p className="text-2xl font-bold">
                    {stats.cachedGames} / {stats.totalGames}
                  </p>
                  <p className="text-xs text-zinc-500">{cachePercentage}%</p>
                </>
              ) : (
                <p className="text-2xl font-bold text-zinc-400">--</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900">
              <Download className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                By Platform
              </p>
              <div className="mt-1 space-y-1 text-sm">
                {stats &&
                  Object.entries(stats.cacheByTool).map(([tool, count]) => (
                    <div key={tool} className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {tool}:
                      </span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                {(!stats ||
                  Object.keys(stats.cacheByTool).length === 0) && (
                  <span className="text-zinc-400">
                    {loading ? "Loading..." : "No tools configured"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
