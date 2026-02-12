import SteamUser from "steam-user";
import { EventEmitter } from "events";
import { prisma } from "../prisma";
import { appLog } from "../app-logger";
import { SteamAuthState } from "@/types";

export interface SteamGuardRequest {
  domain: string | null; // null = TOTP app, string = email domain
}

export interface SteamAppInfo {
  appId: number;
  name: string;
  type: string;
  depots: Map<number, { manifestId: string; maxSize: number }>;
}

export interface PrefillCallbacks {
  onProgress: (downloaded: number, total: number, speed: string) => void;
  onLog: (message: string) => void;
  onDepotStart: (depotId: number, depotIndex: number, totalDepots: number) => void;
  onDepotComplete: (depotId: number) => void;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
  } else if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  } else if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  signal?: AbortSignal,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    if (signal?.aborted) throw new Error("Cancelled");
    const p = task().then(
      () => { executing.delete(p); },
      (err) => { executing.delete(p); throw err; },
    );
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error("Cancelled");
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (signal?.aborted) throw new Error("Cancelled");
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export class SteamClient extends EventEmitter {
  readonly accountId: string;
  private client: SteamUser;
  private _authState: SteamAuthState = SteamAuthState.DISCONNECTED;
  private _pendingSteamGuard: {
    domain: string | null;
    callback: (code: string) => void;
  } | null = null;
  private _ownershipReady = false;
  private _ownershipPromise: Promise<void> | null = null;
  private _ownershipResolve: (() => void) | null = null;
  private _errorMessage: string | null = null;
  private _cancelPrefill: AbortController | null = null;

  constructor(accountId: string) {
    super();
    this.accountId = accountId;
    this.client = new SteamUser({
      enablePicsCache: true,
      autoRelogin: true,
      dataDirectory: null,
      language: "english",
    });
    this.setupEventHandlers();
  }

  // --- Getters ---

  get authState(): SteamAuthState {
    return this._authState;
  }

  get pendingSteamGuard(): SteamGuardRequest | null {
    if (!this._pendingSteamGuard) return null;
    return { domain: this._pendingSteamGuard.domain };
  }

  get isLoggedIn(): boolean {
    return this._authState === SteamAuthState.LOGGED_IN;
  }

  get isOwnershipReady(): boolean {
    return this._ownershipReady;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  // --- Authentication ---

  async login(username: string, password: string): Promise<void> {
    if (this._authState === SteamAuthState.LOGGING_IN || this._authState === SteamAuthState.AWAITING_STEAM_GUARD) {
      throw new Error("Already logging in");
    }
    if (this._authState === SteamAuthState.LOGGED_IN) {
      throw new Error("Already logged in");
    }

    this._authState = SteamAuthState.LOGGING_IN;
    this._errorMessage = null;
    this.emit("state-change", { accountId: this.accountId, state: this._authState });

    await this.updateAccountState({ username });

    appLog.info("Steam", `[${this.accountId}] Logging in as ${username}`);
    this.resetOwnershipPromise();
    this.client.logOn({ accountName: username, password });
  }

  async loginWithRefreshToken(): Promise<void> {
    const account = await prisma.steamAccount.findUnique({
      where: { id: this.accountId },
    });

    if (!account?.refreshToken) {
      throw new Error("No refresh token stored");
    }

    this._authState = SteamAuthState.LOGGING_IN;
    this._errorMessage = null;
    this.emit("state-change", { accountId: this.accountId, state: this._authState });

    appLog.info("Steam", `[${this.accountId}] Reconnecting as ${account.username || "unknown"} with refresh token`);
    this.resetOwnershipPromise();
    this.client.logOn({ refreshToken: account.refreshToken });
  }

  submitSteamGuardCode(code: string): void {
    if (!this._pendingSteamGuard) {
      throw new Error("No pending Steam Guard request");
    }
    appLog.info("Steam", `[${this.accountId}] Submitting Steam Guard code`);
    this._pendingSteamGuard.callback(code);
    this._pendingSteamGuard = null;
    this._authState = SteamAuthState.LOGGING_IN;
    this.emit("state-change", { accountId: this.accountId, state: this._authState });
  }

  async logout(): Promise<void> {
    appLog.info("Steam", `[${this.accountId}] Logging out`);
    this.client.logOff();
    this._authState = SteamAuthState.DISCONNECTED;
    this._ownershipReady = false;
    this._pendingSteamGuard = null;
    this._errorMessage = null;

    await prisma.steamAccount.update({
      where: { id: this.accountId },
      data: { isLoggedIn: false, refreshToken: null },
    });

    this.emit("state-change", { accountId: this.accountId, state: this._authState });
    this.emit("logged-out", { accountId: this.accountId });
  }

  destroy(): void {
    this.client.logOff();
    this.client.removeAllListeners();
    this.removeAllListeners();
  }

  // --- Game Library ---

  async waitForOwnership(): Promise<void> {
    if (this._ownershipReady) return;
    if (!this._ownershipPromise) {
      this.resetOwnershipPromise();
    }
    await this._ownershipPromise;
  }

  getOwnedApps(): number[] {
    if (!this.isLoggedIn) throw new Error("Not logged in");
    if (!this._ownershipReady) throw new Error("Ownership data not ready");
    return this.client.getOwnedApps();
  }

  async getAppInfo(
    appIds: number[],
  ): Promise<Map<number, SteamAppInfo>> {
    if (!this.isLoggedIn) throw new Error("Not logged in");

    const result = new Map<number, SteamAppInfo>();
    const BATCH_SIZE = 50;

    for (let i = 0; i < appIds.length; i += BATCH_SIZE) {
      const batch = appIds.slice(i, i + BATCH_SIZE);
      const productInfo = await this.client.getProductInfo(batch, []);

      for (const [appIdStr, appData] of Object.entries(productInfo.apps)) {
        const appId = parseInt(appIdStr, 10);
        const info = appData.appinfo;
        const depots = new Map<number, { manifestId: string; maxSize: number }>();

        if (info.depots) {
          for (const [depotIdStr, depotData] of Object.entries(info.depots)) {
            const depotId = parseInt(depotIdStr, 10);
            if (isNaN(depotId)) continue;
            if (depotData.depotfromapp) continue;

            const manifestEntry = depotData.manifests?.public;
            if (!manifestEntry) continue;

            const manifestId =
              typeof manifestEntry === "string"
                ? manifestEntry
                : manifestEntry.gid;

            depots.set(depotId, {
              manifestId,
              maxSize: parseInt(depotData.maxsize || "0", 10),
            });
          }
        }

        result.set(appId, {
          appId,
          name: info.common?.name || `App ${appId}`,
          type: info.common?.type || "unknown",
          depots,
        });
      }
    }

    return result;
  }

  // --- CDN Prefill ---

  async prefillApp(
    appId: number,
    callbacks: PrefillCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<{ totalBytes: number; downloadedBytes: number }> {
    if (!this.isLoggedIn) throw new Error("Not logged in");

    callbacks.onLog(`Getting product info for app ${appId}...`);
    const productInfo = await withRetry(
      () => this.client.getProductInfo([appId], []),
      3,
      abortSignal,
    );
    const appData = productInfo.apps[appId];
    if (!appData) throw new Error(`App ${appId} not found`);

    const depotInfo = appData.appinfo.depots;
    if (!depotInfo) throw new Error(`No depot info for app ${appId}`);

    // Collect depots with public manifests
    const depotEntries: Array<{ depotId: number; manifestId: string }> = [];

    for (const [depotIdStr, depotData] of Object.entries(depotInfo)) {
      const depotId = parseInt(depotIdStr, 10);
      if (isNaN(depotId)) continue;
      if (depotData.depotfromapp) continue;

      const manifestEntry = depotData.manifests?.public;
      if (!manifestEntry) continue;

      const manifestId =
        typeof manifestEntry === "string" ? manifestEntry : manifestEntry.gid;

      depotEntries.push({ depotId, manifestId });
    }

    if (depotEntries.length === 0) {
      callbacks.onLog(`No downloadable depots found for app ${appId}`);
      return { totalBytes: 0, downloadedBytes: 0 };
    }

    callbacks.onLog(`Found ${depotEntries.length} depot(s), fetching manifests...`);

    // Phase 1: Get all manifests and calculate total size
    let totalBytes = 0;
    const manifests = new Map<
      number,
      { manifestId: string; files: Array<{ chunks: Array<{ sha: string; cb_original: number }> }> }
    >();

    for (const { depotId, manifestId } of depotEntries) {
      if (abortSignal?.aborted) throw new Error("Cancelled");

      try {
        callbacks.onLog(`Fetching manifest for depot ${depotId}...`);
        const { manifest } = await withRetry(
          () => this.client.getManifest(appId, depotId, manifestId, "public"),
          3,
          abortSignal,
        );

        let depotSize = 0;
        const files: Array<{ chunks: Array<{ sha: string; cb_original: number }> }> = [];

        for (const file of manifest.files) {
          if (!file.chunks || file.chunks.length === 0) continue;
          const fileChunks = file.chunks.map((c) => ({
            sha: c.sha,
            cb_original: c.cb_original,
          }));
          depotSize += fileChunks.reduce((sum, c) => sum + c.cb_original, 0);
          files.push({ chunks: fileChunks });
        }

        totalBytes += depotSize;
        manifests.set(depotId, { manifestId, files });
        callbacks.onLog(`Depot ${depotId}: ${files.length} files, ${formatSpeed(depotSize).replace("/s", "")}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        callbacks.onLog(`Failed to get manifest for depot ${depotId}: ${msg}`);
      }
    }

    if (totalBytes === 0) {
      callbacks.onLog("No chunks to download");
      return { totalBytes: 0, downloadedBytes: 0 };
    }

    callbacks.onLog(`Total download size: ${formatSpeed(totalBytes).replace("/s", "")}`);

    // Phase 2: Download all chunks
    let downloadedBytes = 0;
    const startTime = Date.now();
    let depotIndex = 0;

    const { servers } = await withRetry(
      () => this.client.getContentServers(appId),
      3,
      abortSignal,
    );
    if (servers.length === 0) throw new Error("No content servers available");

    for (const [depotId, depotManifest] of manifests) {
      if (abortSignal?.aborted) throw new Error("Cancelled");

      depotIndex++;
      callbacks.onDepotStart(depotId, depotIndex, manifests.size);

      const allChunks: Array<{ sha: string; cb_original: number }> = [];
      for (const file of depotManifest.files) {
        for (const chunk of file.chunks) {
          allChunks.push(chunk);
        }
      }

      const tasks = allChunks.map((chunk) => async () => {
        if (abortSignal?.aborted) throw new Error("Cancelled");

        await withRetry(async () => {
          const server = servers[Math.floor(Math.random() * servers.length)];
          await this.client.downloadChunk(appId, depotId, chunk.sha, server);
        }, 3, abortSignal);

        downloadedBytes += chunk.cb_original;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
        callbacks.onProgress(downloadedBytes, totalBytes, formatSpeed(speed));
      });

      await runWithConcurrency(tasks, 4, abortSignal);

      callbacks.onDepotComplete(depotId);
    }

    return { totalBytes, downloadedBytes };
  }

  cancelPrefill(): void {
    if (this._cancelPrefill) {
      this._cancelPrefill.abort();
      this._cancelPrefill = null;
    }
  }

  createAbortController(): AbortController {
    this._cancelPrefill = new AbortController();
    return this._cancelPrefill;
  }

  // --- Status ---

  async getStatus(): Promise<{
    accountId: string;
    state: SteamAuthState;
    steamId: string | null;
    displayName: string | null;
    username: string | null;
    pendingSteamGuard: SteamGuardRequest | null;
    error: string | null;
  }> {
    const account = await prisma.steamAccount.findUnique({
      where: { id: this.accountId },
    });

    return {
      accountId: this.accountId,
      state: this._authState,
      steamId: account?.steamId || null,
      displayName: account?.displayName || null,
      username: account?.username || null,
      pendingSteamGuard: this.pendingSteamGuard,
      error: this._errorMessage,
    };
  }

  // --- Internal ---

  private setupEventHandlers(): void {
    this.client.on("loggedOn", async () => {
      this._authState = SteamAuthState.LOGGED_IN;
      this._errorMessage = null;
      const steamId = this.client.steamID?.getSteamID64() || null;

      appLog.info("Steam", `[${this.accountId}] Logged in successfully (SteamID: ${steamId})`);

      await this.updateAccountState({
        steamId,
        isLoggedIn: true,
        lastLogin: new Date(),
      });

      this.emit("state-change", { accountId: this.accountId, state: this._authState });
      this.emit("logged-in", { accountId: this.accountId, steamId });
    });

    this.client.on("steamGuard", (domain: string | null, callback: (code: string) => void) => {
      this._authState = SteamAuthState.AWAITING_STEAM_GUARD;
      this._pendingSteamGuard = { domain, callback };

      const guardType = domain ? `email (${domain})` : "authenticator app";
      appLog.info("Steam", `[${this.accountId}] Steam Guard code required via ${guardType}`);

      this.emit("state-change", { accountId: this.accountId, state: this._authState });
      this.emit("steam-guard-required", { accountId: this.accountId, domain });
    });

    this.client.on("refreshToken", async (token: string) => {
      appLog.debug("Steam", `[${this.accountId}] Received refresh token, persisting to database`);
      await prisma.steamAccount.update({
        where: { id: this.accountId },
        data: { refreshToken: token },
      });
    });

    this.client.on("ownershipCached", () => {
      this._ownershipReady = true;
      appLog.info("Steam", `[${this.accountId}] App ownership data cached`);
      if (this._ownershipResolve) {
        this._ownershipResolve();
        this._ownershipResolve = null;
      }
      this.emit("ownershipCached", { accountId: this.accountId });
    });

    this.client.on("appOwnershipCached", () => {
      // Handled by ownershipCached above
    });

    this.client.on("disconnected", (_eresult: number, msg: string) => {
      this._authState = SteamAuthState.DISCONNECTED;
      this._ownershipReady = false;
      appLog.warn("Steam", `[${this.accountId}] Disconnected: ${msg}`);
      this.emit("state-change", { accountId: this.accountId, state: this._authState });
      this.emit("disconnected", { accountId: this.accountId, msg });
    });

    this.client.on("error", (err: Error) => {
      this._authState = SteamAuthState.ERROR;
      this._errorMessage = err.message;
      this._pendingSteamGuard = null;
      appLog.error("Steam", `[${this.accountId}] Error: ${err.message}`);
      this.emit("state-change", { accountId: this.accountId, state: this._authState });
      this.emit("error", { accountId: this.accountId, message: err.message });
    });

    this.client.on("accountInfo", async () => {
      // Account info received, display name comes from user event
    });

    this.client.on("user", async (sid: { getSteamID64(): string }, persona: { player_name?: string }) => {
      if (this.client.steamID && sid.getSteamID64() === this.client.steamID.getSteamID64()) {
        if (persona.player_name) {
          await this.updateAccountState({ displayName: persona.player_name });
          this.emit("display-name", { accountId: this.accountId, displayName: persona.player_name });
        }
      }
    });
  }

  private resetOwnershipPromise(): void {
    this._ownershipReady = false;
    this._ownershipPromise = new Promise<void>((resolve) => {
      this._ownershipResolve = resolve;
    });
  }

  private async updateAccountState(
    data: Partial<{
      username: string;
      steamId: string | null;
      displayName: string | null;
      isLoggedIn: boolean;
      lastLogin: Date;
    }>,
  ): Promise<void> {
    try {
      await prisma.steamAccount.update({
        where: { id: this.accountId },
        data,
      });
    } catch (err) {
      appLog.error("Steam", `[${this.accountId}] Failed to update account state: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
