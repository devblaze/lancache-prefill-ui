import * as cron from "node-cron";
import { CronExpressionParser } from "cron-parser";
import { prisma } from "./prisma";
import { JobManager } from "./prefill-service";
import { SteamPrefillService } from "./steam/steam-prefill-service";
import { appLog } from "./app-logger";

interface ScheduleWithRelations {
  id: string;
  name: string | null;
  toolId: string;
  type: string;
  cronExpression: string | null;
  scheduledAt: Date | null;
  flags: string | null;
  isEnabled: boolean;
  tool: {
    id: string;
    name: string;
    displayName: string;
    executablePath: string;
    prefillMode: string;
  };
  games: Array<{
    gameId: string;
    game: {
      id: string;
      appId: string;
      name: string;
      sizeBytes: bigint | null;
    };
  }>;
}

class Scheduler {
  private cronTask: ReturnType<typeof cron.schedule> | null = null;
  private running = false;

  start(): void {
    if (this.cronTask) return;

    appLog.info("Scheduler", "Starting scheduler (tick every 60s)");

    // Tick every minute
    this.cronTask = cron.schedule("* * * * *", () => {
      this.tick();
    });
  }

  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      appLog.info("Scheduler", "Scheduler stopped");
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();

      // 1. Find due schedules
      const dueSchedules = await prisma.schedule.findMany({
        where: {
          isEnabled: true,
          nextRunAt: { lte: now },
        },
        include: {
          tool: true,
          games: { include: { game: true } },
        },
      });

      for (const schedule of dueSchedules) {
        await this.executeSchedule(schedule);
      }

      // 2. Check auto-update if enabled
      await this.checkAutoUpdate(now);
    } catch (err) {
      appLog.error(
        "Scheduler",
        `Tick error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      this.running = false;
    }
  }

  private async executeSchedule(
    schedule: ScheduleWithRelations
  ): Promise<void> {
    try {
      const gameIds = schedule.games.map((sg) => sg.gameId);
      if (gameIds.length === 0) return;

      const scheduleName = schedule.name || schedule.id;
      appLog.info(
        "Scheduler",
        `Executing schedule "${scheduleName}" for ${gameIds.length} game(s)`
      );

      // Create a PrefillJob linked to this schedule
      const job = await prisma.prefillJob.create({
        data: {
          toolId: schedule.toolId,
          status: "pending",
          flags: schedule.flags,
          scheduleId: schedule.id,
        },
      });

      // Link games
      const games = schedule.games.map((sg) => sg.game);
      for (const game of games) {
        await prisma.prefillJobGame.create({
          data: {
            jobId: job.id,
            gameId: game.id,
            sizeBytes: game.sizeBytes,
          },
        });
      }

      // Start the job
      const flags = schedule.flags ? JSON.parse(schedule.flags) : {};
      const jobManager = JobManager.getInstance();
      const appIds = games.map((g) => g.appId);

      if (
        schedule.tool.name === "SteamPrefill" &&
        schedule.tool.prefillMode === "native"
      ) {
        const nativeService = new SteamPrefillService(job.id);
        jobManager.registerNativeJob(job.id, nativeService);
        nativeService.startPrefill(appIds);
      } else {
        await jobManager.startJob(
          job.id,
          schedule.tool.executablePath,
          appIds,
          { ...flags, noAnsi: true }
        );
      }

      // Advance the schedule
      await this.advanceSchedule(schedule);
    } catch (err) {
      appLog.error(
        "Scheduler",
        `Failed to execute schedule ${schedule.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async advanceSchedule(
    schedule: ScheduleWithRelations
  ): Promise<void> {
    if (schedule.type === "one-time") {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { isEnabled: false, lastRunAt: new Date(), nextRunAt: null },
      });
    } else if (
      schedule.type === "recurring" &&
      schedule.cronExpression
    ) {
      const nextRun = this.getNextCronRun(schedule.cronExpression);
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date(), nextRunAt: nextRun },
      });
    }
  }

  getNextCronRun(cronExpression: string): Date {
    const interval = CronExpressionParser.parse(cronExpression);
    return interval.next().toDate();
  }

  private async checkAutoUpdate(now: Date): Promise<void> {
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: "default" },
      });
      if (!settings?.enableAutoUpdate) return;

      const [hours, minutes] = (settings.autoUpdateTime || "03:00")
        .split(":")
        .map(Number);

      // Only trigger at the exact configured minute
      if (now.getHours() !== hours || now.getMinutes() !== minutes) return;

      // Guard: check if an auto-update job was already created today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const existingToday = await prisma.prefillJob.findFirst({
        where: {
          flags: { contains: '"autoUpdate":true' },
          createdAt: { gte: todayStart },
        },
      });
      if (existingToday) return;

      // Find all cached games grouped by tool
      const tools = await prisma.prefillTool.findMany({
        where: { isEnabled: true },
        include: {
          games: { where: { isCached: true } },
        },
      });

      for (const tool of tools) {
        if (tool.games.length === 0) continue;

        const flags = { force: true, autoUpdate: true };

        const job = await prisma.prefillJob.create({
          data: {
            toolId: tool.id,
            status: "pending",
            flags: JSON.stringify(flags),
          },
        });

        for (const game of tool.games) {
          await prisma.prefillJobGame.create({
            data: {
              jobId: job.id,
              gameId: game.id,
              sizeBytes: game.sizeBytes,
            },
          });
        }

        const jobManager = JobManager.getInstance();
        const appIds = tool.games.map((g) => g.appId);

        if (
          tool.name === "SteamPrefill" &&
          tool.prefillMode === "native"
        ) {
          const nativeService = new SteamPrefillService(job.id);
          jobManager.registerNativeJob(job.id, nativeService);
          nativeService.startPrefill(appIds);
        } else {
          await jobManager.startJob(job.id, tool.executablePath, appIds, {
            ...flags,
            noAnsi: true,
          });
        }

        appLog.info(
          "Scheduler",
          `Auto-update job ${job.id} created for ${tool.displayName} (${tool.games.length} cached games)`
        );
      }
    } catch (err) {
      appLog.error(
        "Scheduler",
        `Auto-update error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// HMR-safe globalThis singleton
const globalForScheduler = globalThis as unknown as {
  scheduler: Scheduler | undefined;
};

function getScheduler(): Scheduler {
  if (!globalForScheduler.scheduler) {
    globalForScheduler.scheduler = new Scheduler();
  }
  return globalForScheduler.scheduler;
}

export const scheduler = getScheduler();
