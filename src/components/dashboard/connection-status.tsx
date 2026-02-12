"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, Server, Monitor } from "lucide-react";

interface ConnectionStatusProps {
  connectionMode: string;
  lancacheServerUrl: string | null;
  sshHost: string | null;
}

interface StatusData {
  connectionMode: string;
  ssh: {
    configured: boolean;
    connected: boolean;
    error?: string;
  } | null;
  lancache: {
    configured: boolean;
    reachable: boolean;
    responseTimeMs?: number;
    error?: string;
  } | null;
}

export function ConnectionStatus({
  connectionMode,
  lancacheServerUrl,
  sshHost,
}: ConnectionStatusProps) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        const res = await fetch("/api/connection/status");
        if (res.ok && !cancelled) {
          setStatus(await res.json());
        }
      } catch {
        // Ignore fetch errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  if (connectionMode === "local" && !lancacheServerUrl) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">Connection Status</h2>
      {loading ? (
        <p className="text-sm text-zinc-500">Checking connections...</p>
      ) : (
        <div className="space-y-3">
          {/* Connection Mode */}
          <div className="flex items-center gap-3 text-sm">
            <Monitor className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-600 dark:text-zinc-400">Mode:</span>
            <span className="font-medium capitalize">
              {status?.connectionMode || connectionMode}
            </span>
          </div>

          {/* SSH Status */}
          {status?.ssh && (
            <div className="flex items-center gap-3 text-sm">
              {status.ssh.connected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-zinc-600 dark:text-zinc-400">SSH:</span>
              <span
                className={
                  status.ssh.connected ? "text-green-600" : "text-red-600"
                }
              >
                {status.ssh.connected
                  ? `Connected to ${sshHost}`
                  : status.ssh.error || "Disconnected"}
              </span>
            </div>
          )}

          {/* Lancache Status */}
          {status?.lancache && (
            <div className="flex items-center gap-3 text-sm">
              <Server
                className={`h-4 w-4 ${status.lancache.reachable ? "text-green-500" : "text-red-500"}`}
              />
              <span className="text-zinc-600 dark:text-zinc-400">
                Lancache:
              </span>
              <span
                className={
                  status.lancache.reachable ? "text-green-600" : "text-red-600"
                }
              >
                {status.lancache.reachable
                  ? `Reachable (${status.lancache.responseTimeMs}ms)`
                  : status.lancache.error || "Unreachable"}
              </span>
            </div>
          )}

          {/* No connections configured */}
          {!status?.ssh && !status?.lancache && (
            <p className="text-sm text-zinc-500">
              No remote connections configured
            </p>
          )}
        </div>
      )}
    </div>
  );
}
