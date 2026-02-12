import { NextResponse } from "next/server";
import { CacheAnalyzer } from "@/lib/cache-analyzer";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const analyzer = await CacheAnalyzer.fromSettings();
    await analyzer.refreshCacheStatus();

    // Invalidate cached stats so next dashboard load recalculates
    await prisma.settings.update({
      where: { id: "default" },
      data: { cacheStatsUpdatedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to refresh cache status" },
      { status: 500 }
    );
  }
}
