import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testSSHConnection, type SSHConfig } from "@/lib/ssh-client";

export async function POST() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings || !settings.sshHost || !settings.sshUsername) {
      return NextResponse.json(
        {
          success: false,
          error: "SSH not configured. Set host and username in settings.",
        },
        { status: 400 }
      );
    }

    const sshConfig: SSHConfig = {
      host: settings.sshHost,
      port: settings.sshPort,
      username: settings.sshUsername,
      authMethod: (settings.sshAuthMethod as "key" | "password") || "key",
      keyPath: settings.sshKeyPath || undefined,
      password: settings.sshPassword || undefined,
    };

    const result = await testSSHConnection(sshConfig);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to test SSH connection" },
      { status: 500 }
    );
  }
}
