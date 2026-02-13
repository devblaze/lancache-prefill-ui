"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, Server, Monitor, Gamepad2 } from "lucide-react";

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
  steam: {
    total: number;
    connected: number;
    accounts: Array<{ displayName: string | null; username: string | null; connected: boolean }>;
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

  // Don't hide the widget — always show if we have data to display
  const hasRemote = connectionMode !== "local" || !!lancacheServerUrl;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">Connection Status</h2>
      {loading ? (
        <p className="text-sm text-zinc-500">Checking connections...</p>
      ) : (
        <div className="space-y-3">
          {/* Connection Mode */}
          {hasRemote && (
            <div className="flex items-center gap-3 text-sm">
              <Monitor className="h-4 w-4 text-zinc-500" />
              <span className="text-zinc-600 dark:text-zinc-400">Mode:</span>
              <span className="font-medium capitalize">
                {status?.connectionMode || connectionMode}
              </span>
            </div>
          )}

          {/* Steam Accounts */}
          {status?.steam && status.steam.total > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <Gamepad2
                className={`h-4 w-4 ${status.steam.connected > 0 ? "text-green-500" : "text-red-500"}`}
              />
              <span className="text-zinc-600 dark:text-zinc-400">Steam:</span>
              <span
                className={
                  status.steam.connected > 0 ? "text-green-600" : "text-red-600"
                }
              >
                {status.steam.connected === status.steam.total
                  ? `${status.steam.total} account${status.steam.total !== 1 ? "s" : ""} connected`
                  : `${status.steam.connected}/${status.steam.total} connected`}
              </span>
              {status.steam.accounts.length > 0 && (
                <span className="text-zinc-400">
                  ({status.steam.accounts
                    .map((a) => a.displayName || a.username || "Unknown")
                    .join(", ")})
                </span>
              )}
            </div>
          )}

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

          {/* No connections at all */}
          {!status?.ssh && !status?.lancache && !status?.steam && (
            <p className="text-sm text-zinc-500">
              No connections configured
            </p>
          )}
        </div>
      )}
    </div>
  );
}
