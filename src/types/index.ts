export enum PrefillToolName {
  STEAM = "SteamPrefill",
  BATTLENET = "BattleNetPrefill",
  EPIC = "EpicPrefill",
}

export enum JobStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum GameJobStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum LogLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  DEBUG = "debug",
}

export interface PrefillFlags {
  force?: boolean;
  verbose?: boolean;
  unit?: "bits" | "bytes";
  noAnsi?: boolean;
}

export enum SteamAuthState {
  DISCONNECTED = "disconnected",
  LOGGING_IN = "logging_in",
  AWAITING_STEAM_GUARD = "awaiting_steam_guard",
  LOGGED_IN = "logged_in",
  ERROR = "error",
}

export interface SteamAuthStatus {
  accountId: string;
  state: SteamAuthState;
  steamId: string | null;
  displayName: string | null;
  username: string | null;
  pendingSteamGuard: { domain: string | null } | null;
  error: string | null;
}

export interface SSEProgressEvent {
  type: "progress" | "log" | "complete" | "error";
  jobId: string;
  data: {
    gameId?: string;
    progress?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    speed?: string;
    message?: string;
    level?: LogLevel;
  };
}
