import { NextRequest } from "next/server";
import { SteamClientManager } from "@/lib/steam/steam-client-manager";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const manager = SteamClientManager.getInstance();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream may be closed
        }
      };

      const onStateChange = (data: unknown) => sendEvent("state-change", data);
      const onSteamGuard = (data: unknown) => sendEvent("steam-guard-required", data);
      const onLoggedIn = (data: unknown) => sendEvent("logged-in", data);
      const onLoggedOut = (data: unknown) => sendEvent("logged-out", data);
      const onDisplayName = (data: unknown) => sendEvent("display-name", data);
      const onError = (data: unknown) => sendEvent("error", data);
      const onOwnership = (data: unknown) => sendEvent("ownership-cached", data);
      const onAccountRemoved = (data: unknown) => sendEvent("account-removed", data);

      function cleanup() {
        manager.off("state-change", onStateChange);
        manager.off("steam-guard-required", onSteamGuard);
        manager.off("logged-in", onLoggedIn);
        manager.off("logged-out", onLoggedOut);
        manager.off("display-name", onDisplayName);
        manager.off("error", onError);
        manager.off("ownershipCached", onOwnership);
        manager.off("account-removed", onAccountRemoved);
      }

      manager.on("state-change", onStateChange);
      manager.on("steam-guard-required", onSteamGuard);
      manager.on("logged-in", onLoggedIn);
      manager.on("logged-out", onLoggedOut);
      manager.on("display-name", onDisplayName);
      manager.on("error", onError);
      manager.on("ownershipCached", onOwnership);
      manager.on("account-removed", onAccountRemoved);

      // Send initial state for all accounts
      const statuses = await manager.getAllStatuses();
      sendEvent("connected", { accounts: statuses });

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
