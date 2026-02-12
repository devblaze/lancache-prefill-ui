import { NextResponse } from "next/server";
import { CacheAnalyzer } from "@/lib/cache-analyzer";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/app-logger";

const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  appLog.info("API", "GET /api/cache/stats called");
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    // Return cached stats if they exist and are less than 1 hour old
    if (
      settings?.cacheStatsData &&
      settings.cacheStatsUpdatedAt &&
      Date.now() - settings.cacheStatsUpdatedAt.getTime() < CACHE_MAX_AGE_MS
    ) {
      appLog.info("API", "Returning cached cache stats");
      return NextResponse.json(JSON.parse(settings.cacheStatsData));
    }

    // Recalculate
    appLog.info("API", "Cache stats stale or missing, recalculating...");
    const analyzer = await CacheAnalyzer.fromSettings();
    const stats = await analyzer.getCacheStats();

    // Store in database for next time
    await prisma.settings.update({
      where: { id: "default" },
      data: {
        cacheStatsData: JSON.stringify(stats),
        cacheStatsUpdatedAt: new Date(),
      },
    });

    appLog.info("API", "Cache stats recalculated and cached", JSON.stringify(stats, null, 2));
    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appLog.error("API", `Cache stats failed: ${msg}`);
    return NextResponse.json(
      { error: "Failed to fetch cache stats" },
      { status: 500 }
    );
  }
}
