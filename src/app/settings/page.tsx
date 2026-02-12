import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { ToolsConfiguration } from "@/components/settings/tools-configuration";
import { CacheManagement } from "@/components/settings/cache-management";

export default async function SettingsPage() {
  const [settings, tools] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.prefillTool.findMany(),
  ]);

  // Serialize for client components
  const serializedTools = tools.map((tool) => ({
    ...tool,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
  }));

  const serializedSettings = settings
    ? {
        lancachePath: settings.lancachePath,
        refreshInterval: settings.refreshInterval,
        connectionMode: settings.connectionMode,
        sshHost: settings.sshHost,
        sshPort: settings.sshPort,
        sshUsername: settings.sshUsername,
        sshAuthMethod: settings.sshAuthMethod,
        sshKeyPath: settings.sshKeyPath,
        sshPassword: settings.sshPassword,
        lancacheServerUrl: settings.lancacheServerUrl,
        defaultScheduleTime: settings.defaultScheduleTime,
        enableAutoUpdate: settings.enableAutoUpdate,
        autoUpdateTime: settings.autoUpdateTime,
      }
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Configure lancache prefill settings and tools
        </p>
      </div>

      <SettingsForm initialSettings={serializedSettings} />
      <ToolsConfiguration tools={serializedTools} />
      <CacheManagement />
    </div>
  );
}
