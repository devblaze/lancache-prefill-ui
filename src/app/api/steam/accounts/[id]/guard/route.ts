import { NextRequest, NextResponse } from "next/server";
import { SteamClientManager } from "@/lib/steam/steam-client-manager";
import { z } from "zod/v4";

const guardSchema = z.object({
  code: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { code } = guardSchema.parse(body);

    const manager = SteamClientManager.getInstance();
    manager.submitGuardCode(id, code);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
