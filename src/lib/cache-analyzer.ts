import { exec, execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "./prisma";
import { sshExec, type SSHConfig } from "./ssh-client";
import { appLog } from "./app-logger";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

interface CacheAnalyzerOptions {
  cachePath: string;
  connectionMode: "local" | "remote";
  sshConfig?: SSHConfig;
}

export class CacheAnalyzer {
  private cachePath: string;
  private connectionMode: "local" | "remote";
  private sshConfig?: SSHConfig;

  constructor(options?: Partial<CacheAnalyzerOptions>) {
    this.cachePath =
      options?.cachePath || process.env.LANCACHE_PATH || "/data/cache/";
    this.connectionMode = options?.connectionMode || "local";
    this.sshConfig = options?.sshConfig;
  }

  static async fromSettings(): Promise<CacheAnalyzer> {
    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      appLog.warn("CacheAnalyzer", "No settings found, using defaults");
      return new CacheAnalyzer();
    }

    appLog.info(
      "CacheAnalyzer",
      `Loading settings: mode=${settings.connectionMode}, path=${settings.lancachePath}`,
      settings.connectionMode === "remote"
        ? `SSH: ${settings.sshUsername}@${settings.sshHost}:${settings.sshPort} (auth: ${settings.sshAuthMethod})`
        : undefined
    );

    const options: Partial<CacheAnalyzerOptions> = {
      cachePath: settings.lancachePath,
      connectionMode:
        (settings.connectionMode as "local" | "remote") || "local",
    };

    if (
      settings.connectionMode === "remote" &&
      settings.sshHost &&
      settings.sshUsername
    ) {
      options.sshConfig = {
        host: settings.sshHost,
        port: settings.sshPort,
        username: settings.sshUsername,
        authMethod:
          (settings.sshAuthMethod as "key" | "password") || "key",
        keyPath: settings.sshKeyPath || undefined,
        password: settings.sshPassword || undefined,
      };
    } else if (settings.connectionMode === "remote") {
      appLog.error(
        "CacheAnalyzer",
        "Remote mode configured but SSH host or username is missing"
      );
    }

    return new CacheAnalyzer(options);
  }

  private async runCommand(
    command: string,
    args: string[]
  ): Promise<{ stdout: string }> {
    if (this.connectionMode === "remote" && this.sshConfig) {
      const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`);
      const fullCommand = `${command} ${escaped.join(" ")}`;
      appLog.debug("CacheAnalyzer", `Running remote command: ${fullCommand}`);
      const result = await sshExec(this.sshConfig, fullCommand);
      if (result.exitCode !== 0) {
        const msg = `Remote command failed (exit ${result.exitCode}): ${result.stderr}`;
        appLog.error("CacheAnalyzer", msg, fullCommand);
        throw new Error(msg);
      }
      return { stdout: result.stdout };
    }

    appLog.debug("CacheAnalyzer", `Running local command: ${command} ${args.join(" ")}`);
    return execFileAsync(command, args);
  }

  private async runShellCommand(shellCommand: string): Promise<{ stdout: string }> {
    if (this.connectionMode === "remote" && this.sshConfig) {
      appLog.debug("CacheAnalyzer", `Running remote shell command: ${shellCommand}`);
      const result = await sshExec(this.sshConfig, shellCommand);
      // grep returns exit code 1 when no matches — that's not an error
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        const msg = `Remote command failed (exit ${result.exitCode}): ${result.stderr}`;
        appLog.error("CacheAnalyzer", msg, shellCommand);
        throw new Error(msg);
      }
      return { stdout: result.stdout };
    }

    appLog.debug("CacheAnalyzer", `Running local shell command: ${shellCommand}`);
    try {
      return await execAsync(shellCommand);
    } catch (err: unknown) {
      // grep returns exit code 1 when no matches
      if (err && typeof err === "object" && "code" in err && err.code === 1 && "stdout" in err) {
        return { stdout: (err as { stdout: string }).stdout };
      }
      throw err;
    }
  }

  private async runTest(command: string, args: string[]): Promise<boolean> {
    try {
      if (this.connectionMode === "remote" && this.sshConfig) {
        const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`);
        const fullCommand = `${command} ${escaped.join(" ")}`;
        const result = await sshExec(this.sshConfig, fullCommand);
        return result.exitCode === 0;
      }
      await execFileAsync(command, args);
      return true;
    } catch {
      return false;
    }
  }

  async getCacheStats(): Promise<{
    totalSize: number;
    cachedGames: number;
    totalGames: number;
    cacheByTool: Record<string, number>;
    cacheUnavailable?: boolean;
  }> {
    appLog.info("CacheAnalyzer", `Getting cache stats (mode: ${this.connectionMode}, path: ${this.cachePath})`);

    const totalGames = await prisma.game.count();
    const cachedGames = await prisma.game.count({
      where: { isCached: true },
    });

    const tools = await prisma.prefillTool.findMany({
      include: {
        _count: {
          select: {
            games: { where: { isCached: true } },
          },
        },
      },
    });

    const cacheByTool = tools.reduce(
      (acc, tool) => {
        acc[tool.displayName] = tool._count.games;
        return acc;
      },
      {} as Record<string, number>
    );

    let totalSize = 0;
    let cacheUnavailable = false;

    try {
      appLog.debug("CacheAnalyzer", `Running du -sb on ${this.cachePath}`);
      const { stdout } = await this.runCommand("du", ["-sb", this.cachePath]);
      totalSize = parseInt(stdout.split("\t")[0], 10) || 0;
      appLog.info("CacheAnalyzer", `Cache size: ${totalSize} bytes`, `Raw output: ${stdout.trim()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appLog.error("CacheAnalyzer", `Failed to get cache size: ${msg}`);
      cacheUnavailable = true;
    }

    appLog.info(
      "CacheAnalyzer",
      `Stats: totalSize=${totalSize}, cachedGames=${cachedGames}/${totalGames}, unavailable=${cacheUnavailable}`
    );

    return { totalSize, cachedGames, totalGames, cacheByTool, cacheUnavailable };
  }

  async clearCache(platform?: string): Promise<{ cleared: string[] }> {
    const basePath = this.cachePath.replace(/\/+$/, "");
    const cleared: string[] = [];

    // Map platform names to cache subdirectories
    const platformDirs: Record<string, string> = {
      steam: "steam",
      battlenet: "blizzard",
      epic: "epicgames",
    };

    const targetDirs = platform
      ? { [platform]: platformDirs[platform] }
      : platformDirs;

    for (const [name, dir] of Object.entries(targetDirs)) {
      if (!dir) continue;
      const fullPath = `${basePath}/${dir}`;

      const exists = await this.runTest("test", ["-d", fullPath]);
      if (!exists) {
        appLog.info("CacheAnalyzer", `Cache directory not found: ${fullPath}, skipping`);
        continue;
      }

      appLog.info("CacheAnalyzer", `Clearing cache: ${fullPath}`);

      try {
        // Delete contents of the directory, not the directory itself
        // NGINX will recreate subdirectories as needed
        const escapedPath = fullPath.replace(/'/g, "'\\''");
        await this.runShellCommand(`find '${escapedPath}' -mindepth 1 -delete 2>/dev/null`);
        cleared.push(name);
        appLog.info("CacheAnalyzer", `Cleared cache for ${name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appLog.error("CacheAnalyzer", `Failed to clear ${name} cache: ${msg}`);
        throw new Error(
          `Failed to clear ${name} cache: ${msg}. Make sure the cache directory is mounted read-write (not :ro).`
        );
      }
    }

    // Reset isCached flags for affected games
    if (cleared.length > 0) {
      const toolNames = cleared.map((c) => {
        const nameMap: Record<string, string> = {
          steam: "SteamPrefill",
          battlenet: "BattleNetPrefill",
          epic: "EpicPrefill",
        };
        return nameMap[c];
      }).filter(Boolean);

      if (toolNames.length > 0) {
        const tools = await prisma.prefillTool.findMany({
          where: { name: { in: toolNames } },
          select: { id: true },
        });

        const toolIds = tools.map((t) => t.id);
        if (toolIds.length > 0) {
          await prisma.game.updateMany({
            where: { toolId: { in: toolIds } },
            data: { isCached: false, lastChecked: new Date() },
          });
          // Invalidate cached dashboard stats
          await prisma.settings.updateMany({
            where: { id: "default" },
            data: { cacheStatsData: null, cacheStatsUpdatedAt: null },
          });
        }
      }
    }

    return { cleared };
  }

  async refreshCacheStatus(): Promise<void> {
    appLog.info("CacheAnalyzer", "Refreshing cache status for all games");

    const tools = await prisma.prefillTool.findMany({
      include: { games: true },
    });

    for (const tool of tools) {
      if (tool.name === "SteamPrefill") {
        await this.refreshSteamCacheStatus(tool.games);
      }
      // Battle.net and Epic: no per-game detection from cache scanning.
      // Their isCached status is only set via successful prefill completion.
    }

    appLog.info("CacheAnalyzer", "Cache status refresh complete");
  }

  private async refreshSteamCacheStatus(
    games: Array<{ id: string; depots: string | null; isCached: boolean }>
  ): Promise<void> {
    const cachedDepotIds = await this.scanSteamDepotIds();
    const now = new Date();

    // Games without depot data: skip (preserve existing isCached)
    const gamesWithDepots = games.filter((g) => g.depots);

    if (gamesWithDepots.length === 0) {
      appLog.info("CacheAnalyzer", "No Steam games with depot data — re-sync to populate");
      return;
    }

    // If the scan returned no depot IDs but we have games currently marked cached,
    // the scan likely failed (SSH timeout, wrong path, etc.) — preserve existing status
    const previouslyCachedCount = gamesWithDepots.filter((g) => g.isCached).length;
    if (cachedDepotIds.size === 0 && previouslyCachedCount > 0) {
      appLog.warn(
        "CacheAnalyzer",
        `Steam cache scan returned no depots but ${previouslyCachedCount} game(s) are marked cached — skipping status updates to preserve existing data`
      );
      return;
    }

    const cachedGameIds: string[] = [];
    const uncachedGameIds: string[] = [];

    for (const game of gamesWithDepots) {
      try {
        const gameDepots: string[] = JSON.parse(game.depots!);
        const isCached = gameDepots.some((depotId) => cachedDepotIds.has(depotId));

        if (isCached) {
          cachedGameIds.push(game.id);
        } else {
          uncachedGameIds.push(game.id);
        }
      } catch {
        appLog.warn("CacheAnalyzer", `Invalid depot JSON for game ${game.id}`);
      }
    }

    // Batch updates
    if (cachedGameIds.length > 0) {
      await prisma.game.updateMany({
        where: { id: { in: cachedGameIds } },
        data: { isCached: true, lastChecked: now },
      });
    }
    if (uncachedGameIds.length > 0) {
      await prisma.game.updateMany({
        where: { id: { in: uncachedGameIds } },
        data: { isCached: false, lastChecked: now },
      });
    }

    // Invalidate cached dashboard stats so they refresh on next load
    if (cachedGameIds.length > 0 || uncachedGameIds.length > 0) {
      await prisma.settings.updateMany({
        where: { id: "default" },
        data: { cacheStatsData: null, cacheStatsUpdatedAt: null },
      });
    }

    appLog.info(
      "CacheAnalyzer",
      `Steam cache status: ${cachedGameIds.length} cached, ${uncachedGameIds.length} not cached (${games.length - gamesWithDepots.length} skipped — no depot data)`
    );
  }

  private async scanSteamDepotIds(): Promise<Set<string>> {
    // Normalize: remove trailing slash for consistent path building
    const basePath = this.cachePath.replace(/\/+$/, "");
    const steamCachePath = `${basePath}/steam`;

    const exists = await this.runTest("test", ["-d", steamCachePath]);
    if (!exists) {
      appLog.info("CacheAnalyzer", `Steam cache directory not found at ${steamCachePath}`);
      return new Set();
    }

    // Scan NGINX cache files for depot URL references in KEY headers
    // Cache files are binary but contain "KEY: /depot/DEPOTID/chunk/..." near the start
    const escapedPath = steamCachePath.replace(/'/g, "'\\''");
    const shellCmd = `grep -roh --binary-files=text '/depot/[0-9]*/' '${escapedPath}' 2>/dev/null | grep -o '[0-9]*' | sort -un`;

    try {
      const { stdout } = await this.runShellCommand(shellCmd);
      const depotIds = new Set<string>();
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && /^\d+$/.test(trimmed)) {
          depotIds.add(trimmed);
        }
      }
      appLog.info("CacheAnalyzer", `Found ${depotIds.size} unique depot IDs in Steam cache`);
      return depotIds;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appLog.error("CacheAnalyzer", `Failed to scan Steam cache: ${msg}`);
      return new Set();
    }
  }
}
