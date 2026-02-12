"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LogIn, Trash2, Shield, Loader2, CheckCircle, XCircle, User, Plus } from "lucide-react";
import { SteamAuthState } from "@/types";

interface AccountStatus {
  accountId: string;
  state: SteamAuthState;
  steamId: string | null;
  displayName: string | null;
  username: string | null;
  pendingSteamGuard: { domain: string | null } | null;
  error: string | null;
}

export function SteamAuth() {
  const [accounts, setAccounts] = useState<Map<string, AccountStatus>>(new Map());
  const [showAddForm, setShowAddForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [guardCodes, setGuardCodes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/steam/accounts");
      if (res.ok) {
        const data: AccountStatus[] = await res.json();
        setAccounts(new Map(data.map((a) => [a.accountId, a])));
      }
    } catch {
      // Ignore
    }
  }, []);

  // SSE for real-time updates across all accounts
  useEffect(() => {
    const es = new EventSource("/api/steam/accounts/events");
    eventSourceRef.current = es;

    es.addEventListener("connected", (e) => {
      const data = JSON.parse(e.data);
      if (data.accounts) {
        setAccounts(new Map(data.accounts.map((a: AccountStatus) => [a.accountId, a])));
      }
    });

    es.addEventListener("state-change", (e) => {
      const data = JSON.parse(e.data);
      setAccounts((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.accountId);
        if (existing) {
          next.set(data.accountId, { ...existing, state: data.state, error: null });
        }
        return next;
      });
      if (data.state === SteamAuthState.LOGGED_IN) {
        setLoading(false);
        setError(null);
        fetchAccounts();
      }
    });

    es.addEventListener("steam-guard-required", (e) => {
      const data = JSON.parse(e.data);
      setAccounts((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.accountId);
        if (existing) {
          next.set(data.accountId, {
            ...existing,
            state: SteamAuthState.AWAITING_STEAM_GUARD,
            pendingSteamGuard: { domain: data.domain },
          });
        }
        return next;
      });
      setLoading(false);
    });

    es.addEventListener("logged-in", () => {
      setLoading(false);
      setError(null);
      fetchAccounts();
    });

    es.addEventListener("logged-out", (e) => {
      const data = JSON.parse(e.data);
      setAccounts((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.accountId);
        if (existing) {
          next.set(data.accountId, {
            ...existing,
            state: SteamAuthState.DISCONNECTED,
            steamId: null,
            displayName: null,
            pendingSteamGuard: null,
          });
        }
        return next;
      });
    });

    es.addEventListener("display-name", (e) => {
      const data = JSON.parse(e.data);
      setAccounts((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.accountId);
        if (existing) {
          next.set(data.accountId, { ...existing, displayName: data.displayName });
        }
        return next;
      });
    });

    es.addEventListener("account-removed", (e) => {
      const data = JSON.parse(e.data);
      setAccounts((prev) => {
        const next = new Map(prev);
        next.delete(data.accountId);
        return next;
      });
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.accountId) {
          setAccounts((prev) => {
            const next = new Map(prev);
            const existing = next.get(data.accountId);
            if (existing) {
              next.set(data.accountId, { ...existing, state: SteamAuthState.ERROR, error: data.message });
            }
            return next;
          });
        }
      } catch {
        // SSE connection error, not a Steam error
      }
      setLoading(false);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [fetchAccounts]);

  const handleAddAccount = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/steam/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
      } else {
        setUsername("");
        setPassword("");
        setShowAddForm(false);
        // SSE events will update the account list
      }
    } catch {
      setError("Failed to connect to API");
      setLoading(false);
    }
  };

  const handleGuardSubmit = async (accountId: string) => {
    const code = guardCodes.get(accountId) || "";
    if (!code) return;

    try {
      const res = await fetch(`/api/steam/accounts/${accountId}/guard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit code");
      }
      setGuardCodes((prev) => {
        const next = new Map(prev);
        next.delete(accountId);
        return next;
      });
    } catch {
      setError("Failed to connect to API");
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    setRemovingId(accountId);
    try {
      await fetch(`/api/steam/accounts/${accountId}`, { method: "DELETE" });
    } catch {
      setError("Failed to remove account");
    }
    setRemovingId(null);
  };

  const accountList = Array.from(accounts.values());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Steam Accounts ({accountList.filter((a) => a.state === SteamAuthState.LOGGED_IN).length} connected)
        </h4>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Account list */}
      <div className="space-y-2">
        {accountList.map((account) => (
          <AccountRow
            key={account.accountId}
            account={account}
            guardCode={guardCodes.get(account.accountId) || ""}
            onGuardCodeChange={(code) =>
              setGuardCodes((prev) => new Map(prev).set(account.accountId, code))
            }
            onGuardSubmit={() => handleGuardSubmit(account.accountId)}
            onRemove={() => handleRemoveAccount(account.accountId)}
            removing={removingId === account.accountId}
          />
        ))}
      </div>

      {/* Add account form */}
      {showAddForm ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h5 className="text-sm font-medium">Add Steam Account</h5>
          <div>
            <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Steam username"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAccount()}
              placeholder="Steam password"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddAccount}
              disabled={loading || !username || !password}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Login
            </button>
            <button
              onClick={() => { setShowAddForm(false); setUsername(""); setPassword(""); }}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Credentials are used to authenticate with Steam. Only a refresh token is stored.
          </p>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 py-3 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
        >
          <Plus className="h-4 w-4" />
          Add Steam Account
        </button>
      )}
    </div>
  );
}

function AccountRow({
  account,
  guardCode,
  onGuardCodeChange,
  onGuardSubmit,
  onRemove,
  removing,
}: {
  account: AccountStatus;
  guardCode: string;
  onGuardCodeChange: (code: string) => void;
  onGuardSubmit: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const isConnected = account.state === SteamAuthState.LOGGED_IN;
  const isAwaitingGuard = account.state === SteamAuthState.AWAITING_STEAM_GUARD;
  const isLoggingIn = account.state === SteamAuthState.LOGGING_IN;
  const isError = account.state === SteamAuthState.ERROR;

  return (
    <div className={`rounded-lg border p-3 ${
      isConnected
        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
        : isError
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
          : isAwaitingGuard || isLoggingIn
            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
            : "border-zinc-200 dark:border-zinc-700"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className={`h-5 w-5 ${
            isConnected ? "text-green-600 dark:text-green-400"
            : isError ? "text-red-600 dark:text-red-400"
            : "text-zinc-400"
          }`} />
          <div>
            <p className="text-sm font-medium">
              {account.displayName || account.username || "Unknown"}
            </p>
            {account.steamId && (
              <p className="text-xs text-zinc-500">SteamID: {account.steamId}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {isConnected ? (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3" /> Connected
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
              <XCircle className="h-3 w-3" /> Error
            </span>
          ) : isLoggingIn || isAwaitingGuard ? (
            <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              <Loader2 className="h-3 w-3 animate-spin" /> {isAwaitingGuard ? "Guard" : "Logging in"}
            </span>
          ) : null}
          {/* Remove button */}
          <button
            onClick={onRemove}
            disabled={removing}
            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="Remove account"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error message */}
      {isError && account.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{account.error}</p>
      )}

      {/* Steam Guard code input */}
      {isAwaitingGuard && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300">
            <Shield className="h-3.5 w-3.5" />
            {account.pendingSteamGuard?.domain
              ? `Code sent to ${account.pendingSteamGuard.domain}`
              : "Enter authenticator code"}
          </div>
          <input
            type="text"
            value={guardCode}
            onChange={(e) => onGuardCodeChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onGuardSubmit()}
            placeholder="Code"
            maxLength={5}
            className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-center font-mono text-sm tracking-widest dark:border-zinc-700 dark:bg-zinc-800"
            autoFocus
          />
          <button
            onClick={onGuardSubmit}
            disabled={!guardCode}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
