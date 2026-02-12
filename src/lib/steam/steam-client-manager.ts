import { EventEmitter } from "events";
import { prisma } from "../prisma";
import { appLog } from "../app-logger";
import { SteamClient } from "./steam-client";
import { SteamAuthState } from "@/types";

const RECONNECT_EVENTS = [
  "state-change",
  "steam-guard-required",
  "logged-in",
  "logged-out",
  "display-name",
  "error",
  "ownershipCached",
  "disconnected",
] as const;

export class SteamClientManager extends EventEmitter {
  private clients = new Map<string, SteamClient>();
  private _initPromise: Promise<void> | null = null;

  private constructor() {
    super();
  }

  // --- Singleton with globalThis for HMR safety ---

  private static _getInstance(): SteamClientManager {
    const g = globalThis as unknown as { _steamClientManager?: SteamClientManager };
    if (!g._steamClientManager) {
      g._steamClientManager = new SteamClientManager();
    }
    return g._steamClientManager;
  }

  static getInstance(): SteamClientManager {
    const mgr = SteamClientManager._getInstance();
    // Lazily trigger reconnect on first access
    if (!mgr._initPromise) {
      mgr._initPromise = mgr.reconnectAll().catch((err) => {
        appLog.error("Steam", `Failed to reconnect accounts on startup: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    return mgr;
  }

  async ensureReady(): Promise<void> {
    if (this._initPromise) await this._initPromise;
  }

  // --- Client management ---

  getClient(accountId: string): SteamClient {
    const client = this.clients.get(accountId);
    if (!client) throw new Error(`No client for account ${accountId}`);
    return client;
  }

  private getOrCreateClient(accountId: string): SteamClient {
    let client = this.clients.get(accountId);
    if (!client) {
      client = new SteamClient(accountId);
      this.clients.set(accountId, client);
      this.wireClientEvents(client);
    }
    return client;
  }

  // --- Authentication ---

  async loginNewAccount(username: string, password: string): Promise<string> {
    // Create DB row first
    const account = await prisma.steamAccount.create({
      data: { username },
    });

    const client = this.getOrCreateClient(account.id);
    await client.login(username, password);

    return account.id;
  }

  submitGuardCode(accountId: string, code: string): void {
    const client = this.getClient(accountId);
    client.submitSteamGuardCode(code);
  }

  async logoutAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (client) {
      await client.logout();
    }
  }

  async removeAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (client) {
      client.destroy();
      this.clients.delete(accountId);
    }

    // DB row + cascade-delete GameOwnership
    await prisma.steamAccount.delete({
      where: { id: accountId },
    });

    this.emit("account-removed", { accountId });
    appLog.info("Steam", `Account ${accountId} removed`);
  }

  // --- Reconnect all accounts on startup ---

  async reconnectAll(): Promise<void> {
    const accounts = await prisma.steamAccount.findMany({
      where: { refreshToken: { not: null } },
    });

    if (accounts.length === 0) {
      appLog.info("Steam", "No accounts with refresh tokens to reconnect");
      return;
    }

    appLog.info("Steam", `Reconnecting ${accounts.length} account(s)...`);

    for (const account of accounts) {
      try {
        const client = this.getOrCreateClient(account.id);
        await client.loginWithRefreshToken();
        // Stagger reconnections to avoid rate limiting
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        appLog.error("Steam", `Failed to reconnect ${account.username || account.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // --- Query ---

  getLoggedInClients(): Array<{ accountId: string; client: SteamClient }> {
    const result: Array<{ accountId: string; client: SteamClient }> = [];
    for (const [accountId, client] of this.clients) {
      if (client.isLoggedIn) {
        result.push({ accountId, client });
      }
    }
    return result;
  }

  async getAllStatuses(): Promise<
    Array<{
      accountId: string;
      state: SteamAuthState;
      steamId: string | null;
      displayName: string | null;
      username: string | null;
      pendingSteamGuard: { domain: string | null } | null;
      error: string | null;
    }>
  > {
    // Include both active clients and DB-only accounts (disconnected but stored)
    const dbAccounts = await prisma.steamAccount.findMany();
    const statuses = [];

    for (const account of dbAccounts) {
      const client = this.clients.get(account.id);
      if (client) {
        statuses.push(await client.getStatus());
      } else {
        statuses.push({
          accountId: account.id,
          state: SteamAuthState.DISCONNECTED,
          steamId: account.steamId,
          displayName: account.displayName,
          username: account.username,
          pendingSteamGuard: null,
          error: null,
        });
      }
    }

    return statuses;
  }

  // --- Internal ---

  private wireClientEvents(client: SteamClient): void {
    for (const eventName of RECONNECT_EVENTS) {
      client.on(eventName, (...args: unknown[]) => {
        this.emit(eventName, ...args);
      });
    }
  }
}
