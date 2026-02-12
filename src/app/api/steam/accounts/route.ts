import { NextRequest, NextResponse } from "next/server";
import { SteamClientManager } from "@/lib/steam/steam-client-manager";
import { z } from "zod/v4";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// GET — list all accounts with live status
export async function GET() {
  try {
    const manager = SteamClientManager.getInstance();
    const statuses = await manager.getAllStatuses();
    return NextResponse.json(statuses);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — login a new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const manager = SteamClientManager.getInstance();
    const accountId = await manager.loginNewAccount(username, password);

    return NextResponse.json({ accountId, success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
