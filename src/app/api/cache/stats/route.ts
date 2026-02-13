import { NextResponse } from "next/server";
import { CacheAnalyzer } from "@/lib/cache-analyzer";
import { prisma } from "@/lib/prisma";
import { appLog } from "@/lib/app-logger";

const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: Request) {
  appLog.info("API", "GET /api/cache/stats called");
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "1";

    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    // Return cached stats if they exist, are less than 1 hour old, and not forced
    if (
      !force &&
      settings?.cacheStatsData &&
      settings.cacheStatsUpdatedAt &&
      Date.now() - settings.cacheStatsUpdatedAt.getTime() < CACHE_MAX_AGE_MS
    ) {
      const cached = JSON.parse(settings.cacheStatsData);
      // Don't serve cached results that had cacheUnavailable — retry instead
      if (!cached.cacheUnavailable) {
        appLog.info("API", "Returning cached cache stats");
        return NextResponse.json(cached);
      }
      appLog.info("API", "Cached stats had cacheUnavailable, recalculating...");
    }

    // Recalculate
    appLog.info("API", "Cache stats stale or missing, recalculating...");
    const analyzer = await CacheAnalyzer.fromSettings();
    const stats = await analyzer.getCacheStats();

    // Only cache successful results (not unavailable ones)
    if (!stats.cacheUnavailable) {
      await prisma.settings.update({
        where: { id: "default" },
        data: {
          cacheStatsData: JSON.stringify(stats),
          cacheStatsUpdatedAt: new Date(),
        },
      });
      appLog.info("API", "Cache stats recalculated and cached", JSON.stringify(stats, null, 2));
    } else {
      appLog.warn("API", "Cache stats unavailable, not caching result");
    }

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
