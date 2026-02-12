import { EventEmitter } from "events";
import { prisma } from "../prisma";
import { appLog } from "../app-logger";
import { SteamClientManager } from "./steam-client-manager";
import { JobStatus, LogLevel, GameJobStatus } from "@/types";

export class SteamPrefillService extends EventEmitter {
  private jobId: string;
  private abortController: AbortController;

  constructor(jobId: string) {
    super();
    this.jobId = jobId;
    this.abortController = new AbortController();
  }

  async startPrefill(appIds: string[]): Promise<void> {
    const manager = SteamClientManager.getInstance();
    const loggedInClients = manager.getLoggedInClients();

    if (loggedInClients.length === 0) {
      const msg = "No Steam accounts logged in";
      this.emit("error", { jobId: this.jobId, message: msg });
      await this.updateJobStatus(JobStatus.FAILED, msg);
      return;
    }

    await this.updateJobStatus(JobStatus.RUNNING);
    this.emit("log", { level: LogLevel.INFO, message: `Starting native Steam prefill for ${appIds.length} game(s)` });
    await this.saveLog(LogLevel.INFO, `Starting native Steam prefill for ${appIds.length} game(s)`);

    try {
      // Look up game ownership to route each game to the correct account
      const games = await prisma.game.findMany({
        where: { appId: { in: appIds } },
        include: { ownerships: true },
      });

      // Build map: accountId -> list of { appId, gameName }
      const accountGameMap = new Map<string, Array<{ appId: string; gameName: string }>>();
      const loggedInIds = new Set(loggedInClients.map((c) => c.accountId));

      for (const game of games) {
        // Find a logged-in account that owns this game
        const ownership = game.ownerships.find((o) => loggedInIds.has(o.steamAccountId));

        if (!ownership) {
          const msg = `No logged-in account owns "${game.name}" (${game.appId}), skipping`;
          this.emit("log", { level: LogLevel.WARNING, message: msg });
          await this.saveLog(LogLevel.WARNING, msg);
          await this.updateGameStatus(game.appId, GameJobStatus.FAILED);
          continue;
        }

        const existing = accountGameMap.get(ownership.steamAccountId) || [];
        existing.push({ appId: game.appId, gameName: game.name });
        accountGameMap.set(ownership.steamAccountId, existing);
      }

      // Process each account's games
      let succeededCount = 0;
      let failedCount = 0;

      for (const [accountId, accountGames] of accountGameMap) {
        if (this.abortController.signal.aborted) break;

        const client = manager.getClient(accountId);
        await client.waitForOwnership();

        const msg = `Using account ${accountId} for ${accountGames.length} game(s)`;
        this.emit("log", { level: LogLevel.INFO, message: msg });
        await this.saveLog(LogLevel.INFO, msg);

        for (const { appId: appIdStr, gameName } of accountGames) {
          if (this.abortController.signal.aborted) break;

          const appId = parseInt(appIdStr, 10);

          this.emit("log", { level: LogLevel.INFO, message: `Prefilling: ${gameName} (${appId})` });
          await this.saveLog(LogLevel.INFO, `Prefilling: ${gameName} (${appId})`);
          await this.updateGameStatus(appIdStr, GameJobStatus.DOWNLOADING);

          try {
            const result = await client.prefillApp(
              appId,
              {
                onProgress: (downloaded, total, speed) => {
                  const progress = total > 0 ? (downloaded / total) * 100 : 0;
                  this.emit("progress", {
                    appId: appIdStr,
                    gameName,
                    progress,
                    downloadedBytes: downloaded,
                    totalBytes: total,
                    speed,
                  });
                },
                onLog: (message) => {
                  this.emit("log", { level: LogLevel.INFO, message });
                  this.saveLog(LogLevel.INFO, message);
                },
                onDepotStart: (depotId, depotIndex, totalDepots) => {
                  const depotMsg = `Downloading depot ${depotId} (${depotIndex}/${totalDepots})`;
                  this.emit("log", { level: LogLevel.INFO, message: depotMsg });
                  this.saveLog(LogLevel.INFO, depotMsg);
                },
                onDepotComplete: (depotId) => {
                  const depotMsg = `Completed depot ${depotId}`;
                  this.emit("log", { level: LogLevel.INFO, message: depotMsg });
                  this.saveLog(LogLevel.INFO, depotMsg);
                },
              },
              this.abortController.signal,
            );

            succeededCount++;
            this.emit("game-complete", { appId: appIdStr, gameName });
            await this.updateGameStatus(appIdStr, GameJobStatus.COMPLETED);
            await this.markGameCached(appIdStr);

            const completeMsg = `Completed ${gameName}: ${formatBytes(result.downloadedBytes)} downloaded`;
            this.emit("log", { level: LogLevel.INFO, message: completeMsg });
            await this.saveLog(LogLevel.INFO, completeMsg);
          } catch (err) {
            if (this.abortController.signal.aborted) break;

            failedCount++;
            const errMsg = err instanceof Error ? err.message : String(err);
            appLog.error("Steam", `Prefill failed for ${gameName}: ${errMsg}`);
            this.emit("game-error", { appId: appIdStr, gameName, message: errMsg });
            this.emit("log", { level: LogLevel.ERROR, message: `Failed: ${gameName} - ${errMsg}` });
            await this.saveLog(LogLevel.ERROR, `Failed: ${gameName} - ${errMsg}`);
            await this.updateGameStatus(appIdStr, GameJobStatus.FAILED);
          }
        }
      }

      if (this.abortController.signal.aborted) {
        await this.updateJobStatus(JobStatus.CANCELLED);
        this.emit("complete", { jobId: this.jobId });
      } else if (succeededCount === 0 && failedCount > 0) {
        const errorMsg = `All ${failedCount} game(s) failed`;
        await this.updateJobStatus(JobStatus.FAILED, errorMsg);
        this.emit("error", { jobId: this.jobId, message: errorMsg });
      } else {
        if (failedCount > 0) {
          const warnMsg = `${failedCount} of ${succeededCount + failedCount} game(s) failed`;
          this.emit("log", { level: LogLevel.WARNING, message: warnMsg });
          await this.saveLog(LogLevel.WARNING, warnMsg);
        }
        await this.updateJobStatus(JobStatus.COMPLETED);
        this.emit("complete", { jobId: this.jobId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appLog.error("Steam", `Job ${this.jobId} failed: ${msg}`);
      this.emit("error", { jobId: this.jobId, message: msg });
      await this.updateJobStatus(JobStatus.FAILED, msg);
    }
  }

  async cancel(): Promise<void> {
    this.abortController.abort();
    await this.updateJobStatus(JobStatus.CANCELLED);
    this.emit("complete", { jobId: this.jobId });
  }

  private async updateJobStatus(
    status: JobStatus,
    errorMessage?: string,
  ): Promise<void> {
    const data: Record<string, unknown> = { status };
    if (errorMessage) data.errorMessage = errorMessage;
    if (status === JobStatus.RUNNING) data.startedAt = new Date();
    if (
      [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(status)
    ) {
      data.completedAt = new Date();
    }

    await prisma.prefillJob.update({
      where: { id: this.jobId },
      data,
    });
  }

  private async updateGameStatus(
    appId: string,
    status: GameJobStatus,
  ): Promise<void> {
    try {
      const game = await prisma.game.findFirst({ where: { appId } });
      if (!game) return;

      await prisma.prefillJobGame.updateMany({
        where: { jobId: this.jobId, gameId: game.id },
        data: { status },
      });
    } catch {
      // Don't break the flow for status update failures
    }
  }

  private async markGameCached(appId: string): Promise<void> {
    try {
      await prisma.game.updateMany({
        where: { appId },
        data: { isCached: true, lastChecked: new Date() },
      });
      // Invalidate cached dashboard stats so they refresh on next load
      await prisma.settings.updateMany({
        where: { id: "default" },
        data: { cacheStatsData: null, cacheStatsUpdatedAt: null },
      });
    } catch {
      // Don't break the prefill flow for cache status update failures
    }
  }

  private async saveLog(level: LogLevel, message: string): Promise<void> {
    try {
      await prisma.prefillJobLog.create({
        data: {
          jobId: this.jobId,
          level,
          message: message.slice(0, 2000),
        },
      });
    } catch {
      // Ignore log save failures
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}
