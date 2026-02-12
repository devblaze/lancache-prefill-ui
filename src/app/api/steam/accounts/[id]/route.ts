import { NextRequest, NextResponse } from "next/server";
import { SteamClientManager } from "@/lib/steam/steam-client-manager";

// GET — single account status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const manager = SteamClientManager.getInstance();
    const statuses = await manager.getAllStatuses();
    const status = statuses.find((s) => s.accountId === id);

    if (!status) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — remove account (logout + delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const manager = SteamClientManager.getInstance();
    await manager.removeAccount(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
