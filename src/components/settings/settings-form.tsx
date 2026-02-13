"use client";

import { useState, useRef, useCallback } from "react";
import { Save, Wifi, Server, Monitor, Check, Clock, RefreshCw } from "lucide-react";

interface SettingsFormProps {
  initialSettings: {
    lancachePath: string;
    refreshInterval: number;
    connectionMode: string;
    sshHost: string | null;
    sshPort: number;
    sshUsername: string | null;
    sshAuthMethod: string;
    sshKeyPath: string | null;
    sshPassword: string | null;
    lancacheServerUrl: string | null;
    defaultScheduleTime: string;
    enableAutoUpdate: boolean;
    autoUpdateTime: string;
  } | null;
  activeTab?: string;
}

export function SettingsForm({ initialSettings, activeTab }: SettingsFormProps) {
  const showGeneral = !activeTab || activeTab === "general";
  const showConnection = !activeTab || activeTab === "connection";
  const [lancachePath, setLancachePath] = useState(
    initialSettings?.lancachePath || "/data/cache/"
  );
  const [refreshInterval, setRefreshInterval] = useState(
    initialSettings?.refreshInterval || 3600
  );
  const [connectionMode, setConnectionMode] = useState(
    initialSettings?.connectionMode || "local"
  );
  const [sshHost, setSshHost] = useState(initialSettings?.sshHost || "");
  const [sshPort, setSshPort] = useState(initialSettings?.sshPort || 22);
  const [sshUsername, setSshUsername] = useState(
    initialSettings?.sshUsername || ""
  );
  const [sshAuthMethod, setSshAuthMethod] = useState(
    initialSettings?.sshAuthMethod || "key"
  );
  const [sshKeyPath, setSshKeyPath] = useState(
    initialSettings?.sshKeyPath || ""
  );
  const [sshPassword, setSshPassword] = useState(
    initialSettings?.sshPassword || ""
  );
  const [lancacheServerUrl, setLancacheServerUrl] = useState(
    initialSettings?.lancacheServerUrl || ""
  );
  const [defaultScheduleTime, setDefaultScheduleTime] = useState(
    initialSettings?.defaultScheduleTime || "01:00"
  );
  const [enableAutoUpdate, setEnableAutoUpdate] = useState(
    initialSettings?.enableAutoUpdate || false
  );
  const [autoUpdateTime, setAutoUpdateTime] = useState(
    initialSettings?.autoUpdateTime || "03:00"
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sshTesting, setSshTesting] = useState(false);
  const [sshTestResult, setSshTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const [lancacheTesting, setLancacheTesting] = useState(false);
  const [lancacheTestResult, setLancacheTestResult] = useState<{
    reachable?: boolean;
    responseTimeMs?: number;
    error?: string;
  } | null>(null);

  // Track last saved snapshot to detect changes
  const lastSavedRef = useRef({
    lancachePath: initialSettings?.lancachePath || "/data/cache/",
    refreshInterval: initialSettings?.refreshInterval || 3600,
    connectionMode: initialSettings?.connectionMode || "local",
    sshHost: initialSettings?.sshHost || "",
    sshPort: initialSettings?.sshPort || 22,
    sshUsername: initialSettings?.sshUsername || "",
    sshAuthMethod: initialSettings?.sshAuthMethod || "key",
    sshKeyPath: initialSettings?.sshKeyPath || "",
    sshPassword: initialSettings?.sshPassword || "",
    lancacheServerUrl: initialSettings?.lancacheServerUrl || "",
    defaultScheduleTime: initialSettings?.defaultScheduleTime || "01:00",
    enableAutoUpdate: initialSettings?.enableAutoUpdate || false,
    autoUpdateTime: initialSettings?.autoUpdateTime || "03:00",
  });

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) {
      return `http://${trimmed}`;
    }
    return trimmed;
  };

  const saveSettings = useCallback(
    async (overrides?: Partial<typeof lastSavedRef.current>): Promise<boolean> => {
      setSaving(true);
      setSaved(false);
      setSaveError(null);

      const current = {
        lancachePath,
        refreshInterval,
        connectionMode,
        sshHost,
        sshPort,
        sshUsername,
        sshAuthMethod,
        sshKeyPath,
        sshPassword,
        lancacheServerUrl,
        defaultScheduleTime,
        enableAutoUpdate,
        autoUpdateTime,
        ...overrides,
      };

      try {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lancachePath: current.lancachePath,
            refreshInterval: current.refreshInterval,
            connectionMode: current.connectionMode,
            sshHost: current.sshHost || null,
            sshPort: current.sshPort,
            sshUsername: current.sshUsername || null,
            sshAuthMethod: current.sshAuthMethod,
            sshKeyPath: current.sshKeyPath || null,
            sshPassword: current.sshPassword || null,
            lancacheServerUrl: normalizeUrl(current.lancacheServerUrl),
            defaultScheduleTime: current.defaultScheduleTime,
            enableAutoUpdate: current.enableAutoUpdate,
            autoUpdateTime: current.autoUpdateTime,
          }),
        });

        if (response.ok) {
          lastSavedRef.current = current;
          setSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
          return true;
        } else {
          const data = await response.json();
          setSaveError(
            data.error
              ? `Failed to save: ${JSON.stringify(data.error)}`
              : "Failed to save settings"
          );
          return false;
        }
      } catch (error) {
        console.error("Failed to save settings:", error);
        setSaveError("Failed to save settings");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      lancachePath,
      refreshInterval,
      connectionMode,
      sshHost,
      sshPort,
      sshUsername,
      sshAuthMethod,
      sshKeyPath,
      sshPassword,
      lancacheServerUrl,
      defaultScheduleTime,
      enableAutoUpdate,
      autoUpdateTime,
    ]
  );

  const hasChanges = useCallback(() => {
    const s = lastSavedRef.current;
    return (
      lancachePath !== s.lancachePath ||
      refreshInterval !== s.refreshInterval ||
      connectionMode !== s.connectionMode ||
      sshHost !== s.sshHost ||
      sshPort !== s.sshPort ||
      sshUsername !== s.sshUsername ||
      sshAuthMethod !== s.sshAuthMethod ||
      sshKeyPath !== s.sshKeyPath ||
      sshPassword !== s.sshPassword ||
      lancacheServerUrl !== s.lancacheServerUrl ||
      defaultScheduleTime !== s.defaultScheduleTime ||
      enableAutoUpdate !== s.enableAutoUpdate ||
      autoUpdateTime !== s.autoUpdateTime
    );
  }, [
    lancachePath,
    refreshInterval,
    connectionMode,
    sshHost,
    sshPort,
    sshUsername,
    sshAuthMethod,
    sshKeyPath,
    sshPassword,
    lancacheServerUrl,
    defaultScheduleTime,
    enableAutoUpdate,
    autoUpdateTime,
  ]);

  // Auto-save on blur if values changed
  const autoSaveOnBlur = useCallback(() => {
    if (hasChanges()) {
      saveSettings();
    }
  }, [hasChanges, saveSettings]);

  // For buttons that change state instantly, save with the new value
  const setConnectionModeAndSave = (mode: string) => {
    setConnectionMode(mode);
    saveSettings({ connectionMode: mode });
  };

  const setSshAuthMethodAndSave = (method: string) => {
    setSshAuthMethod(method);
    saveSettings({ sshAuthMethod: method });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings();
  };

  const testSSH = async () => {
    setSshTesting(true);
    setSshTestResult(null);
    const ok = await saveSettings();
    if (!ok) {
      setSshTestResult({ success: false, error: "Settings failed to save" });
      setSshTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/connection/test-ssh", { method: "POST" });
      const result = await res.json();
      setSshTestResult(result);
    } catch {
      setSshTestResult({ success: false, error: "Request failed" });
    } finally {
      setSshTesting(false);
    }
  };

  const testLancache = async () => {
    setLancacheTesting(true);
    setLancacheTestResult(null);
    const ok = await saveSettings();
    if (!ok) {
      setLancacheTestResult({ error: "Settings failed to save" });
      setLancacheTesting(false);
      return;
    }
    try {
      const res = await fetch("/api/connection/test-lancache", {
        method: "POST",
      });
      const result = await res.json();
      setLancacheTestResult(result);
    } catch {
      setLancacheTestResult({ error: "Request failed" });
    } finally {
      setLancacheTesting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800";
  const labelClass = "mb-2 block text-sm font-medium";
  const helperClass = "mt-1 text-xs text-zinc-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Auto-save status bar */}
      <div className={`flex items-center justify-end gap-2 text-sm ${showGeneral || showConnection ? "" : "hidden"}`}>
        {saving && (
          <span className="text-zinc-500">Saving...</span>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-green-600">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        {saveError && (
          <span className="text-red-600">{saveError}</span>
        )}
      </div>

      {/* General Settings */}
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${showGeneral ? "" : "hidden"}`}>
        <h2 className="mb-4 text-xl font-semibold">General Settings</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Lancache Cache Path</label>
            <input
              type="text"
              value={lancachePath}
              onChange={(e) => setLancachePath(e.target.value)}
              onBlur={autoSaveOnBlur}
              placeholder="/data/cache/"
              className={inputClass}
            />
            <p className={helperClass}>
              Path to your lancache NGINX cache directory. On Unraid, use the
              host-side Docker volume path (e.g.{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                /mnt/user/appdata/lancache/cache/
              </code>
              )
            </p>
          </div>

          <div>
            <label className={labelClass}>
              Cache Refresh Interval (seconds)
            </label>
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              onBlur={autoSaveOnBlur}
              min={60}
              className={inputClass}
            />
            <p className={helperClass}>
              How often to re-check which games are cached
            </p>
          </div>
        </div>
      </div>

      {/* Scheduling & Auto-Update */}
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${showGeneral ? "" : "hidden"}`}>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Clock className="h-5 w-5" />
          Scheduling & Auto-Update
        </h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Default Schedule Time</label>
            <input
              type="time"
              value={defaultScheduleTime}
              onChange={(e) => setDefaultScheduleTime(e.target.value)}
              onBlur={autoSaveOnBlur}
              className={inputClass}
            />
            <p className={helperClass}>
              New scheduled downloads will default to this time
            </p>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  Auto-Update Cached Games
                </label>
                <p className="text-xs text-zinc-500">
                  Automatically re-download cached games daily to keep them up
                  to date
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !enableAutoUpdate;
                  setEnableAutoUpdate(next);
                  saveSettings({ enableAutoUpdate: next });
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  enableAutoUpdate ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    enableAutoUpdate ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {enableAutoUpdate && (
            <div>
              <label className={labelClass}>
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                Auto-Update Time
              </label>
              <input
                type="time"
                value={autoUpdateTime}
                onChange={(e) => setAutoUpdateTime(e.target.value)}
                onBlur={autoSaveOnBlur}
                className={inputClass}
              />
              <p className={helperClass}>
                Time to check for and download updates to cached games daily
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Connection Mode */}
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${showConnection ? "" : "hidden"}`}>
        <h2 className="mb-4 text-xl font-semibold">Connection Mode</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Choose how to access the lancache server&apos;s cache directory for
          stats
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConnectionModeAndSave("local")}
            className={`flex flex-1 items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
              connectionMode === "local"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
            }`}
          >
            <Monitor className="h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">Local</div>
              <div className="text-xs text-zinc-500">
                Cache directory is on this machine
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setConnectionModeAndSave("remote")}
            className={`flex flex-1 items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
              connectionMode === "remote"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
            }`}
          >
            <Server className="h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">Remote (SSH)</div>
              <div className="text-xs text-zinc-500">
                Connect to a remote server via SSH
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* SSH Configuration */}
      {connectionMode === "remote" && showConnection && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold">SSH Configuration</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>SSH Host</label>
                <input
                  type="text"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  onBlur={autoSaveOnBlur}
                  placeholder="192.168.1.100"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Port</label>
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(parseInt(e.target.value, 10))}
                  onBlur={autoSaveOnBlur}
                  min={1}
                  max={65535}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Username</label>
              <input
                type="text"
                value={sshUsername}
                onChange={(e) => setSshUsername(e.target.value)}
                onBlur={autoSaveOnBlur}
                placeholder="root"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Authentication Method</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSshAuthMethodAndSave("key")}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    sshAuthMethod === "key"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  SSH Key
                </button>
                <button
                  type="button"
                  onClick={() => setSshAuthMethodAndSave("password")}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    sshAuthMethod === "password"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  Password
                </button>
              </div>
            </div>

            {sshAuthMethod === "key" && (
              <div>
                <label className={labelClass}>SSH Key Path</label>
                <input
                  type="text"
                  value={sshKeyPath}
                  onChange={(e) => setSshKeyPath(e.target.value)}
                  onBlur={autoSaveOnBlur}
                  placeholder="~/.ssh/id_rsa"
                  className={inputClass}
                />
                <p className={helperClass}>
                  Absolute path to your SSH private key file
                </p>
              </div>
            )}

            {sshAuthMethod === "password" && (
              <div>
                <label className={labelClass}>SSH Password</label>
                <input
                  type="password"
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                  onBlur={autoSaveOnBlur}
                  placeholder="Enter password"
                  className={inputClass}
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={testSSH}
                disabled={sshTesting || !sshHost || !sshUsername}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {sshTesting ? (
                  <Wifi className="h-4 w-4 animate-pulse" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {sshTesting ? "Testing..." : "Test SSH Connection"}
              </button>
              {sshTestResult && (
                <span
                  className={`text-sm ${sshTestResult.success ? "text-green-600" : "text-red-600"}`}
                >
                  {sshTestResult.success
                    ? "Connected successfully!"
                    : `Failed: ${sshTestResult.error}`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lancache Server URL */}
      <div className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${showConnection ? "" : "hidden"}`}>
        <h2 className="mb-4 text-xl font-semibold">Lancache Server</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Server URL</label>
            <input
              type="text"
              value={lancacheServerUrl}
              onChange={(e) => setLancacheServerUrl(e.target.value)}
              onBlur={autoSaveOnBlur}
              placeholder="http://192.168.1.100"
              className={inputClass}
            />
            <p className={helperClass}>
              URL of your lancache server for health/connectivity checks
              (optional)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testLancache}
              disabled={lancacheTesting || !lancacheServerUrl}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {lancacheTesting ? (
                <Server className="h-4 w-4 animate-pulse" />
              ) : (
                <Server className="h-4 w-4" />
              )}
              {lancacheTesting ? "Testing..." : "Test Lancache Connection"}
            </button>
            {lancacheTestResult && (
              <span
                className={`text-sm ${lancacheTestResult.reachable ? "text-green-600" : "text-red-600"}`}
              >
                {lancacheTestResult.reachable
                  ? `Reachable (${lancacheTestResult.responseTimeMs}ms)`
                  : `Unreachable: ${lancacheTestResult.error}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Manual Save Button (fallback) */}
      <div className={`flex items-center gap-3 ${showGeneral || showConnection ? "" : "hidden"}`}>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
