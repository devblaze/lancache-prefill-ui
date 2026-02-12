"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw, HelpCircle, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, X } from "lucide-react";
import { SteamAuth } from "./steam-auth";

interface Tool {
  id: string;
  name: string;
  displayName: string;
  executablePath: string;
  configPath: string | null;
  isConfigured: boolean;
  isEnabled: boolean;
  prefillMode: string;
}

interface ToolsConfigurationProps {
  tools: Tool[];
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastIdCounter = 0;

export function ToolsConfiguration({ tools: initialTools }: ToolsConfigurationProps) {
  const router = useRouter();
  const [tools, setTools] = useState(initialTools);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTool = (id: string, field: string, value: string | boolean) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const saveTool = async (tool: Tool) => {
    setSaving(tool.id);
    try {
      await fetch(`/api/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executablePath: tool.executablePath,
          configPath: tool.configPath,
          isEnabled: tool.isEnabled,
          prefillMode: tool.prefillMode,
        }),
      });
    } catch (error) {
      console.error("Failed to save tool:", error);
    } finally {
      setSaving(null);
    }
  };

  const syncGames = async (toolId: string) => {
    setSyncing(toolId);
    try {
      const response = await fetch("/api/games/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast("success", `Successfully synced ${data.count} game${data.count !== 1 ? "s" : ""}`);
        router.refresh();
      } else {
        const err = await response.json();
        showToast("error", `Sync failed: ${err.error}`);
      }
    } catch (error) {
      console.error("Failed to sync games:", error);
      showToast("error", "Sync failed. Check the console for details.");
    } finally {
      setSyncing(null);
    }
  };

  const [showGuide, setShowGuide] = useState<string | null>(null);

  const isSteam = (tool: Tool) => tool.name === "SteamPrefill";
  const isBattleNet = (tool: Tool) => tool.name === "BattleNetPrefill";
  const isEpic = (tool: Tool) => tool.name === "EpicPrefill";
  const isNativeMode = (tool: Tool) => tool.prefillMode === "native";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-semibold">Prefill Tools</h2>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="mb-4 space-y-2">
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}

      <div className="space-y-6">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">{tool.displayName}</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={tool.isEnabled}
                  onChange={(e) =>
                    updateTool(tool.id, "isEnabled", e.target.checked)
                  }
                  className="rounded"
                />
                <span className="text-sm">Enabled</span>
              </label>
            </div>

            {/* Mode selector for Steam */}
            {isSteam(tool) && (
              <div className="mb-3">
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                  Prefill Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateTool(tool.id, "prefillMode", "cli")}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      !isNativeMode(tool)
                        ? "bg-blue-600 text-white"
                        : "border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    CLI (SteamPrefill binary)
                  </button>
                  <button
                    onClick={() => updateTool(tool.id, "prefillMode", "native")}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      isNativeMode(tool)
                        ? "bg-blue-600 text-white"
                        : "border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Native (steam-user)
                  </button>
                </div>
              </div>
            )}

            {/* CLI mode: show path inputs */}
            {(!isSteam(tool) || !isNativeMode(tool)) && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                    Executable Path
                  </label>
                  <input
                    type="text"
                    value={tool.executablePath}
                    onChange={(e) =>
                      updateTool(tool.id, "executablePath", e.target.value)
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                    Config Path
                  </label>
                  <input
                    type="text"
                    value={tool.configPath || ""}
                    onChange={(e) =>
                      updateTool(tool.id, "configPath", e.target.value)
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
              </div>
            )}

            {/* Native mode: show Steam auth */}
            {isSteam(tool) && isNativeMode(tool) && (
              <div className="mt-2">
                <SteamAuth />
              </div>
            )}

            {/* Setup guide for CLI tools */}
            {(isBattleNet(tool) || isEpic(tool)) && (
              <div className="mt-3">
                <button
                  onClick={() => setShowGuide(showGuide === tool.name ? null : tool.name)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Setup Guide
                  {showGuide === tool.name ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showGuide === tool.name && (
                  <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
                    {isBattleNet(tool) && <BattleNetGuide />}
                    {isEpic(tool) && <EpicGuide />}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => saveTool(tool)}
                disabled={saving === tool.id}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {saving === tool.id ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => syncGames(tool.id)}
                disabled={syncing === tool.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <RefreshCw
                  className={`h-3 w-3 ${syncing === tool.id ? "animate-spin" : ""}`}
                />
                {syncing === tool.id ? "Syncing..." : "Sync Games"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2 ${
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

function BattleNetGuide() {
  return (
    <div className="space-y-3 text-zinc-700 dark:text-zinc-300">
      <h5 className="font-semibold">Battle.net Prefill Setup</h5>

      <div>
        <p className="mb-1 font-medium">1. Download BattleNetPrefill</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Download the latest release from{" "}
          <a
            href="https://github.com/tpill90/battlenet-lancache-prefill/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
          >
            GitHub Releases
          </a>
          . Extract the binary and place it somewhere accessible (e.g.{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">/usr/local/bin/BattleNetPrefill</code>).
        </p>
      </div>

      <div>
        <p className="mb-1 font-medium">2. Make it executable</p>
        <pre className="rounded bg-zinc-900 p-2 text-xs text-zinc-100 dark:bg-zinc-800">chmod +x /usr/local/bin/BattleNetPrefill</pre>
      </div>

      <div>
        <p className="mb-1 font-medium">3. Authenticate</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Run the tool once to authenticate with your Battle.net account:
        </p>
        <pre className="mt-1 rounded bg-zinc-900 p-2 text-xs text-zinc-100 dark:bg-zinc-800">BattleNetPrefill select-apps</pre>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          This opens a browser window for Battle.net OAuth login. After authenticating, the token is stored in{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">~/.config/BattleNetPrefill/</code>.
        </p>
      </div>

      <div>
        <p className="mb-1 font-medium">4. Configure paths above</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Set the <strong>Executable Path</strong> to where you placed the binary, and the <strong>Config Path</strong> to
          the config directory. Then click <strong>Save</strong> and <strong>Sync Games</strong>.
        </p>
      </div>

      <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
        <strong>Note:</strong> Your lancache DNS must resolve Battle.net CDN domains (e.g. blzddist*-a.akamaihd.net) to your lancache server IP for downloads to be cached.
      </div>
    </div>
  );
}

function EpicGuide() {
  return (
    <div className="space-y-3 text-zinc-700 dark:text-zinc-300">
      <h5 className="font-semibold">Epic Games Prefill Setup</h5>

      <div>
        <p className="mb-1 font-medium">1. Download EpicPrefill</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Download the latest release from{" "}
          <a
            href="https://github.com/tpill90/epic-lancache-prefill/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
          >
            GitHub Releases
          </a>
          . Extract the binary and place it somewhere accessible (e.g.{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">/usr/local/bin/EpicPrefill</code>).
        </p>
      </div>

      <div>
        <p className="mb-1 font-medium">2. Make it executable</p>
        <pre className="rounded bg-zinc-900 p-2 text-xs text-zinc-100 dark:bg-zinc-800">chmod +x /usr/local/bin/EpicPrefill</pre>
      </div>

      <div>
        <p className="mb-1 font-medium">3. Authenticate</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Run the tool once to authenticate with your Epic Games account:
        </p>
        <pre className="mt-1 rounded bg-zinc-900 p-2 text-xs text-zinc-100 dark:bg-zinc-800">EpicPrefill select-apps</pre>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          This opens a browser window for Epic Games OAuth login. After authenticating, the token is stored in{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">~/.config/EpicPrefill/</code>.
        </p>
      </div>

      <div>
        <p className="mb-1 font-medium">4. Configure paths above</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Set the <strong>Executable Path</strong> to where you placed the binary, and the <strong>Config Path</strong> to
          the config directory. Then click <strong>Save</strong> and <strong>Sync Games</strong>.
        </p>
      </div>

      <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
        <strong>Note:</strong> Your lancache DNS must resolve Epic CDN domains (e.g. epicgames-download1.akamaized.net) to your lancache server IP for downloads to be cached.
      </div>
    </div>
  );
}
