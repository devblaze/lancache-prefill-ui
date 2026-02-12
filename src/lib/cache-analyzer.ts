import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "./prisma";
import { sshExec, type SSHConfig } from "./ssh-client";
import { appLog } from "./app-logger";

const execFileAsync = promisify(execFile);

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

  async refreshCacheStatus(): Promise<void> {
    appLog.info("CacheAnalyzer", "Refreshing cache status for all games");

    const tools = await prisma.prefillTool.findMany({
      include: { games: true },
    });

    for (const tool of tools) {
      const cacheDomain = this.getCacheDomain(tool.name);
      appLog.debug("CacheAnalyzer", `Checking ${tool.displayName} (domain: ${cacheDomain}, ${tool.games.length} games)`);

      for (const game of tool.games) {
        const isCached = await this.isGameCached(cacheDomain);
        if (isCached !== game.isCached) {
          await prisma.game.update({
            where: { id: game.id },
            data: { isCached, lastChecked: new Date() },
          });
        }
      }
    }

    appLog.info("CacheAnalyzer", "Cache status refresh complete");
  }

  private async isGameCached(
    cacheDomain: string,
  ): Promise<boolean> {
    const domainPath = `${this.cachePath}/${cacheDomain}`;
    return this.runTest("test", ["-d", domainPath]);
  }

  private getCacheDomain(toolName: string): string {
    const domainMap: Record<string, string> = {
      SteamPrefill: "steam",
      BattleNetPrefill: "blizzard",
      EpicPrefill: "epicgames",
    };
    return domainMap[toolName] || "unknown";
  }
}
