"use client";

import { useState, useCallback, useEffect } from "react";
import { Trash2, AlertTriangle, RefreshCw, X, CheckCircle2, AlertCircle } from "lucide-react";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastId = 0;

export function CacheManagement() {
  const [clearing, setClearing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearCache = async (platform?: string) => {
    setConfirmTarget(null);
    setClearing(platform || "all");
    try {
      const response = await fetch("/api/cache/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (response.ok) {
        const data = await response.json();
        const label = platform || "all platforms";
        showToast(
          "success",
          data.cleared.length > 0
            ? `Cache cleared for ${data.cleared.join(", ")}`
            : `No cache directories found for ${label}`
        );
      } else {
        const err = await response.json();
        showToast("error", err.error || "Failed to clear cache");
      }
    } catch {
      showToast("error", "Failed to clear cache");
    } finally {
      setClearing(null);
    }
  };

  const refreshCache = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/cache/refresh", { method: "POST" });
      if (response.ok) {
        showToast("success", "Cache status refreshed");
      } else {
        showToast("error", "Failed to refresh cache status");
      }
    } catch {
      showToast("error", "Failed to refresh cache status");
    } finally {
      setRefreshing(false);
    }
  };

  const platforms = [
    { key: "steam", label: "Steam", color: "blue" },
    { key: "battlenet", label: "Battle.net", color: "blue" },
    { key: "epic", label: "Epic Games", color: "blue" },
  ];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-semibold">Cache Management</h2>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="mb-4 space-y-2">
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      {/* Refresh Cache Status */}
      <div className="mb-6">
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Scan the cache directory to detect which games are already cached.
        </p>
        <button
          onClick={refreshCache}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Scanning..." : "Refresh Cache Status"}
        </button>
      </div>

      {/* Clear Cache */}
      <div>
        <h3 className="mb-1 text-sm font-medium">Clear Cache</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Delete cached game data from the lancache. This frees disk space but means games will
          need to be re-downloaded from the internet.
        </p>

        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Note:</strong> The cache directory must be mounted read-write (not{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">:ro</code>) for clearing
          to work.
        </div>

        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button
              key={p.key}
              onClick={() => setConfirmTarget(p.key)}
              disabled={clearing !== null}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {clearing === p.key ? "Clearing..." : `Clear ${p.label}`}
            </button>
          ))}
          <button
            onClick={() => setConfirmTarget("all")}
            disabled={clearing !== null}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {clearing === "all" ? "Clearing..." : "Clear All Cache"}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Confirm Clear Cache</h3>
            </div>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              {confirmTarget === "all"
                ? "This will delete ALL cached game data across all platforms."
                : `This will delete all cached ${
                    platforms.find((p) => p.key === confirmTarget)?.label
                  } game data.`}
            </p>
            <p className="mb-6 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Games will need to be re-downloaded from the internet. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  clearCache(confirmTarget === "all" ? undefined : confirmTarget)
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
