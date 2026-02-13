import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import { SteamClientManager } from "@/lib/steam/steam-client-manager";
import { appLog } from "@/lib/app-logger";

export async function POST(request: NextRequest) {
  try {
    const { toolId } = await request.json();

    const tool = await prisma.prefillTool.findUnique({
      where: { id: toolId },
    });

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Branch based on prefill mode
    if (tool.name === "SteamPrefill" && tool.prefillMode === "native") {
      return await syncSteamNative(tool.id);
    }

    // CLI mode (default)
    const games = await discoverGames(tool.executablePath);

    let count = 0;
    for (const game of games) {
      await prisma.game.upsert({
        where: {
          toolId_appId: {
            toolId: tool.id,
            appId: game.appId,
          },
        },
        create: {
          toolId: tool.id,
          appId: game.appId,
          name: game.name,
          sizeBytes: game.sizeBytes ?? null,
        },
        update: {
          name: game.name,
          sizeBytes: game.sizeBytes ?? null,
        },
      });
      count++;
    }

    // Mark tool as configured after successful sync
    if (count > 0 && !tool.isConfigured) {
      await prisma.prefillTool.update({
        where: { id: tool.id },
        data: { isConfigured: true },
      });
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Sync failed: ${message}` },
      { status: 500 }
    );
  }
}

async function syncSteamNative(toolId: string) {
  const manager = SteamClientManager.getInstance();
  const loggedInClients = manager.getLoggedInClients();

  if (loggedInClients.length === 0) {
    return NextResponse.json(
      { error: "No Steam accounts logged in. Please add an account in Settings." },
      { status: 400 },
    );
  }

  appLog.info("Steam", `Starting native game sync across ${loggedInClients.length} account(s)`);

  let count = 0;
  for (const { accountId, client } of loggedInClients) {
    appLog.info("Steam", `Syncing games for account ${accountId}`);

    await client.waitForOwnership();
    const ownedAppIds = client.getOwnedApps();
    appLog.info("Steam", `Account ${accountId}: ${ownedAppIds.length} owned apps`);

    const appInfo = await client.getAppInfo(ownedAppIds);

    for (const [, info] of appInfo) {
      if (info.type !== "Game" && info.type !== "game") continue;

      let totalSize = BigInt(0);
      const depotIds: string[] = [];
      for (const [depotId, depot] of info.depots) {
        depotIds.push(String(depotId));
        if (depot.maxSize > 0) {
          totalSize += BigInt(depot.maxSize);
        }
      }

      const depotsJson = depotIds.length > 0 ? JSON.stringify(depotIds) : null;

      // Upsert canonical game record (deduplicated by toolId+appId)
      const game = await prisma.game.upsert({
        where: {
          toolId_appId: {
            toolId,
            appId: String(info.appId),
          },
        },
        create: {
          toolId,
          appId: String(info.appId),
          name: info.name,
          sizeBytes: totalSize > 0 ? totalSize : null,
          depots: depotsJson,
        },
        update: {
          name: info.name,
          sizeBytes: totalSize > 0 ? totalSize : null,
          depots: depotsJson,
        },
      });

      // Upsert ownership record linking this game to this account
      await prisma.gameOwnership.upsert({
        where: {
          gameId_steamAccountId: {
            gameId: game.id,
            steamAccountId: accountId,
          },
        },
        create: {
          gameId: game.id,
          steamAccountId: accountId,
        },
        update: {},
      });

      count++;
    }
  }

  // Mark tool as configured after successful sync
  if (count > 0) {
    await prisma.prefillTool.update({
      where: { id: toolId },
      data: { isConfigured: true },
    });
  }

  appLog.info("Steam", `Synced ${count} game entries across all accounts`);
  return NextResponse.json({ success: true, count });
}

interface DiscoveredGame {
  appId: string;
  name: string;
  sizeBytes?: bigint;
}

function discoverGames(executablePath: string): Promise<DiscoveredGame[]> {
  return new Promise((resolve, reject) => {
    const games: DiscoveredGame[] = [];
    const proc = spawn(executablePath, [
      "select-apps",
      "status",
      "--no-ansi",
    ]);

    let buffer = "";

    proc.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      console.error(`[sync stderr] ${data.toString()}`);
    });

    proc.on("close", (code: number | null) => {
      if (code !== 0 && games.length === 0) {
        reject(
          new Error(
            `Tool exited with code ${code}. Ensure the tool is configured and authenticated.`
          )
        );
        return;
      }

      const lines = buffer.split("\n");
      for (const line of lines) {
        const match = line.match(
          /^\s*(\d+)\s+(.+?)(?:\s+(\d+(?:\.\d+)?)\s*([KMGT]?B))?\s*$/
        );
        if (match) {
          const [, appId, name, size, unit] = match;
          games.push({
            appId,
            name: name.trim(),
            sizeBytes:
              size && unit ? parseSizeToBigInt(size, unit) : undefined,
          });
        }
      }
      resolve(games);
    });

    proc.on("error", (error) => {
      reject(
        new Error(
          `Failed to run tool: ${error.message}. Check executable path.`
        )
      );
    });
  });
}

function parseSizeToBigInt(value: string, unit: string): bigint {
  const val = parseFloat(value);
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  return BigInt(Math.floor(val * (multipliers[unit.toUpperCase()] || 1)));
}
