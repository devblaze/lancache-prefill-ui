export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppLogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
}

const MAX_ENTRIES = 500;

class AppLogger {
  private static instance: AppLogger;
  private logs: AppLogEntry[] = [];
  private nextId = 1;

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  private add(level: LogLevel, source: string, message: string, details?: string) {
    const entry: AppLogEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details,
    };

    this.logs.push(entry);

    // Trim to max entries
    if (this.logs.length > MAX_ENTRIES) {
      this.logs = this.logs.slice(-MAX_ENTRIES);
    }
  }

  debug(source: string, message: string, details?: string) {
    this.add("debug", source, message, details);
  }

  info(source: string, message: string, details?: string) {
    this.add("info", source, message, details);
  }

  warn(source: string, message: string, details?: string) {
    this.add("warn", source, message, details);
  }

  error(source: string, message: string, details?: string) {
    this.add("error", source, message, details);
  }

  getAll(): AppLogEntry[] {
    return [...this.logs];
  }

  getRecent(count: number): AppLogEntry[] {
    return this.logs.slice(-count);
  }

  getSince(id: number): AppLogEntry[] {
    return this.logs.filter((entry) => entry.id > id);
  }

  clear() {
    this.logs = [];
  }
}

const globalForLogger = globalThis as unknown as {
  appLogger: AppLogger | undefined;
};

export const appLog =
  globalForLogger.appLogger ?? AppLogger.getInstance();

if (process.env.NODE_ENV !== "production")
  globalForLogger.appLogger = appLog;
