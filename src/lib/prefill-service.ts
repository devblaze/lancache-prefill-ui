import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { prisma } from "./prisma";
import { JobStatus, LogLevel, type PrefillFlags } from "@/types";

export interface PrefillProgress {
  appId?: string;
  gameName?: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: string;
}

export class PrefillService extends EventEmitter {
  private process: ChildProcess | null = null;
  private jobId: string;
  private toolPath: string;

  constructor(jobId: string, toolPath: string) {
    super();
    this.jobId = jobId;
    this.toolPath = toolPath;
  }

  async startPrefill(args: string[], flags: PrefillFlags): Promise<void> {
    const cliArgs = this.buildArgs(args, flags);

    this.process = spawn(this.toolPath, cliArgs, {
      env: { ...process.env },
    });

    if (!this.process.stdout || !this.process.stderr) {
      throw new Error("Failed to create process streams");
    }

    let buffer = "";

    this.process.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        this.parseLine(line);
      }
    });

    this.process.stderr.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.emit("log", { level: LogLevel.ERROR, message });
        this.saveLog(LogLevel.ERROR, message);
      }
    });

    this.process.on("close", async (code: number | null) => {
      // Flush remaining buffer
      if (buffer.trim()) {
        this.parseLine(buffer);
      }

      if (code === 0) {
        this.emit("complete", { jobId: this.jobId });
        await this.updateJobStatus(JobStatus.COMPLETED);
        await this.markJobGamesCached();
      } else {
        const msg = `Process exited with code ${code}`;
        this.emit("error", { jobId: this.jobId, message: msg });
        await this.updateJobStatus(JobStatus.FAILED, msg);
      }
    });

    this.process.on("error", async (error: Error) => {
      this.emit("error", { jobId: this.jobId, message: error.message });
      await this.updateJobStatus(JobStatus.FAILED, error.message);
    });

    await this.updateJobStatus(JobStatus.RUNNING);
  }

  private buildArgs(gameArgs: string[], flags: PrefillFlags): string[] {
    const args = ["prefill", "--no-ansi"];

    if (flags.force) args.push("--force");
    if (flags.verbose) args.push("--verbose");
    if (flags.unit) args.push("--unit", flags.unit);

    args.push(...gameArgs);

    return args;
  }

  private parseLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Progress pattern: look for percentage
    const progressMatch = trimmed.match(
      /(\d+(?:\.\d+)?)\s*%/
    );

    // Speed pattern
    const speedMatch = trimmed.match(
      /(\d+(?:\.\d+)?)\s*(MB\/s|Mbps|KB\/s|GB\/s)/i
    );

    if (progressMatch) {
      const progress = parseFloat(progressMatch[1]);

      // Try to extract size info
      const sizeMatch = trimmed.match(
        /(\d+(?:\.\d+)?)\s*([KMGT]?B)\s*\/\s*(\d+(?:\.\d+)?)\s*([KMGT]?B)/i
      );

      const progressData: PrefillProgress = {
        progress,
        downloadedBytes: sizeMatch
          ? this.parseSizeToBytes(sizeMatch[1], sizeMatch[2])
          : 0,
        totalBytes: sizeMatch
          ? this.parseSizeToBytes(sizeMatch[3], sizeMatch[4])
          : 0,
        speed: speedMatch ? `${speedMatch[1]} ${speedMatch[2]}` : undefined,
      };

      this.emit("progress", progressData);
    }

    // Log every line
    this.emit("log", { level: LogLevel.INFO, message: trimmed });
    this.saveLog(LogLevel.INFO, trimmed);
  }

  private parseSizeToBytes(value: string, unit: string): number {
    const val = parseFloat(value);
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };
    return val * (multipliers[unit.toUpperCase()] || 1);
  }

  async cancel(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
      await this.updateJobStatus(JobStatus.CANCELLED);
      this.emit("complete", { jobId: this.jobId });
    }
  }

  private async updateJobStatus(
    status: JobStatus,
    errorMessage?: string
  ): Promise<void> {
    const data: Record<string, unknown> = { status };
    if (errorMessage) data.errorMessage = errorMessage;
    if (status === JobStatus.RUNNING) data.startedAt = new Date();
    if (
      [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(
        status
      )
    ) {
      data.completedAt = new Date();
    }

    await prisma.prefillJob.update({
      where: { id: this.jobId },
      data,
    });
  }

  private async markJobGamesCached(): Promise<void> {
    try {
      const jobGames = await prisma.prefillJobGame.findMany({
        where: { jobId: this.jobId },
        select: { gameId: true },
      });

      const gameIds = jobGames.map((jg) => jg.gameId);
      if (gameIds.length > 0) {
        await prisma.game.updateMany({
          where: { id: { in: gameIds } },
          data: { isCached: true, lastChecked: new Date() },
        });
        // Invalidate cached dashboard stats so they refresh on next load
        await prisma.settings.updateMany({
          where: { id: "default" },
          data: { cacheStatsData: null, cacheStatsUpdatedAt: null },
        });
      }
    } catch {
      // Don't break the flow for cache status update failures
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
      // Ignore log save failures to not break the main flow
    }
  }
}

// Common interface for both CLI and native job runners
export interface PrefillJobRunner extends EventEmitter {
  cancel(): Promise<void>;
}

// Singleton to manage active prefill jobs
export class JobManager {
  private static instance: JobManager;
  private activeJobs = new Map<string, PrefillJobRunner>();

  static getInstance(): JobManager {
    if (!JobManager.instance) {
      JobManager.instance = new JobManager();
    }
    return JobManager.instance;
  }

  async startJob(
    jobId: string,
    toolPath: string,
    args: string[],
    flags: PrefillFlags
  ): Promise<PrefillService> {
    if (this.activeJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    const service = new PrefillService(jobId, toolPath);
    this.activeJobs.set(jobId, service);

    service.on("complete", () => {
      this.activeJobs.delete(jobId);
    });

    service.on("error", () => {
      this.activeJobs.delete(jobId);
    });

    await service.startPrefill(args, flags);
    return service;
  }

  registerNativeJob(jobId: string, service: PrefillJobRunner): void {
    if (this.activeJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    this.activeJobs.set(jobId, service);

    service.on("complete", () => {
      this.activeJobs.delete(jobId);
    });

    service.on("error", () => {
      this.activeJobs.delete(jobId);
    });
  }

  getJob(jobId: string): PrefillJobRunner | undefined {
    return this.activeJobs.get(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job) {
      await job.cancel();
      this.activeJobs.delete(jobId);
    }
  }

  getActiveJobIds(): string[] {
    return Array.from(this.activeJobs.keys());
  }
}
