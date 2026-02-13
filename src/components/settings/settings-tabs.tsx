"use client";

import { useState } from "react";
import { Settings, Wifi, Wrench, HardDrive } from "lucide-react";
import { SettingsForm } from "./settings-form";
import { ToolsConfiguration } from "./tools-configuration";
import { CacheManagement } from "./cache-management";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "connection", label: "Connection", icon: Wifi },
  { id: "tools", label: "Prefill Tools", icon: Wrench },
  { id: "cache", label: "Cache", icon: HardDrive },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SettingsTabsProps {
  settings: {
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
  tools: Array<{
    id: string;
    name: string;
    displayName: string;
    executablePath: string;
    configPath: string | null;
    isConfigured: boolean;
    isEnabled: boolean;
    prefillMode: string;
  }>;
}

export function SettingsTabs({ settings, tools }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content — SettingsForm is always mounted to preserve state */}
      <div className={activeTab === "general" || activeTab === "connection" ? "" : "hidden"}>
        <SettingsForm initialSettings={settings} activeTab={activeTab} />
      </div>
      <div className={activeTab === "tools" ? "" : "hidden"}>
        <ToolsConfiguration tools={tools} />
      </div>
      <div className={activeTab === "cache" ? "" : "hidden"}>
        <CacheManagement />
      </div>
    </div>
  );
}
