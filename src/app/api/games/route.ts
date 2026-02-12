import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const toolId = searchParams.get("toolId");
  const cached = searchParams.get("cached");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (toolId) where.toolId = toolId;
  if (cached !== null && cached !== undefined && cached !== "") {
    where.isCached = cached === "true";
  }
  if (search) {
    where.name = { contains: search };
  }

  const games = await prisma.game.findMany({
    where,
    include: { tool: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(games);
}
