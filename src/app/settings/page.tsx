import { prisma } from "@/lib/prisma";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export default async function SettingsPage() {
  const [settings, tools] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.prefillTool.findMany(),
  ]);

  const serializedTools = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    displayName: tool.displayName,
    executablePath: tool.executablePath,
    configPath: tool.configPath,
    isConfigured: tool.isConfigured,
    isEnabled: tool.isEnabled,
    prefillMode: tool.prefillMode,
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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Configure lancache prefill settings and tools
        </p>
      </div>

      <SettingsTabs settings={serializedSettings} tools={serializedTools} />
    </div>
  );
}
