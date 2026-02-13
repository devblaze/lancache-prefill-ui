import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testSSHConnection, type SSHConfig } from "@/lib/ssh-client";
import { checkLancacheHealth } from "@/lib/lancache-health";
import { SteamClientManager } from "@/lib/steam/steam-client-manager";

export async function GET() {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  const status: {
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
  } = {
    connectionMode: settings?.connectionMode || "local",
    ssh: null,
    lancache: null,
    steam: null,
  };

  if (
    settings?.connectionMode === "remote" &&
    settings.sshHost &&
    settings.sshUsername
  ) {
    const sshConfig: SSHConfig = {
      host: settings.sshHost,
      port: settings.sshPort,
      username: settings.sshUsername,
      authMethod: (settings.sshAuthMethod as "key" | "password") || "key",
      keyPath: settings.sshKeyPath || undefined,
      password: settings.sshPassword || undefined,
    };
    const sshResult = await testSSHConnection(sshConfig);
    status.ssh = {
      configured: true,
      connected: sshResult.success,
      error: sshResult.error,
    };
  } else if (settings?.connectionMode === "remote") {
    status.ssh = {
      configured: false,
      connected: false,
      error: "SSH host or username not set",
    };
  }

  if (settings?.lancacheServerUrl) {
    const healthResult = await checkLancacheHealth(settings.lancacheServerUrl);
    status.lancache = {
      configured: true,
      reachable: healthResult.reachable,
      responseTimeMs: healthResult.responseTimeMs,
      error: healthResult.error,
    };
  }

  // Steam accounts
  try {
    const manager = SteamClientManager.getInstance();
    const allStatuses = await manager.getAllStatuses();
    if (allStatuses.length > 0) {
      const connected = allStatuses.filter((a) => a.state === "logged_in").length;
      status.steam = {
        total: allStatuses.length,
        connected,
        accounts: allStatuses.map((a) => ({
          displayName: a.displayName,
          username: a.username,
          connected: a.state === "logged_in",
        })),
      };
    }
  } catch {
    // Ignore Steam status errors
  }

  return NextResponse.json(status);
}
