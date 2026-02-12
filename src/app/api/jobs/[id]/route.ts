import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await prisma.prefillJob.findUnique({
    where: { id },
    include: {
      tool: true,
      games: {
        include: { game: true },
      },
      logs: {
        orderBy: { timestamp: "asc" },
        take: 500,
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
