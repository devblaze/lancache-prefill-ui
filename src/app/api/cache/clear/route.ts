import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { CacheAnalyzer } from "@/lib/cache-analyzer";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/app-logger";

const clearSchema = z.object({
  platform: z.enum(["steam", "battlenet", "epic"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform } = clearSchema.parse(body);

    appLog.info("API", `POST /api/cache/clear (platform: ${platform || "all"})`);

    const analyzer = await CacheAnalyzer.fromSettings();
    const result = await analyzer.clearCache(platform);

    // Invalidate cached stats
    await prisma.settings.update({
      where: { id: "default" },
      data: { cacheStatsUpdatedAt: null },
    });

    appLog.info("API", `Cache cleared: ${result.cleared.join(", ") || "none"}`);
    return NextResponse.json({ success: true, cleared: result.cleared });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appLog.error("API", `Cache clear failed: ${msg}`);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
