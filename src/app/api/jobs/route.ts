import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobManager } from "@/lib/prefill-service";
import { SteamPrefillService } from "@/lib/steam/steam-prefill-service";
import { z } from "zod/v4";

const createJobSchema = z.object({
  toolId: z.string(),
  gameIds: z.array(z.string()),
  flags: z
    .object({
      force: z.boolean().optional(),
      verbose: z.boolean().optional(),
      unit: z.enum(["bits", "bytes"]).optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const jobs = await prisma.prefillJob.findMany({
    where,
    include: {
      tool: true,
      games: {
        include: { game: true },
      },
      schedule: {
        select: { id: true, name: true, type: true },
      },
      _count: {
        select: { logs: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const serialized = JSON.parse(
    JSON.stringify(jobs, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json(serialized);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolId, gameIds, flags = {} } = createJobSchema.parse(body);

    const tool = await prisma.prefillTool.findUnique({
      where: { id: toolId },
    });

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Create job record
    const job = await prisma.prefillJob.create({
      data: {
        toolId,
        status: "pending",
        flags: JSON.stringify(flags),
      },
    });

    // Link games to job
    const games = await prisma.game.findMany({
      where: { id: { in: gameIds } },
    });

    for (const game of games) {
      await prisma.prefillJobGame.create({
        data: {
          jobId: job.id,
          gameId: game.id,
          sizeBytes: game.sizeBytes,
        },
      });
    }

    // Start the prefill process
    const jobManager = JobManager.getInstance();
    const appIds = games.map((g) => g.appId);

    if (tool.name === "SteamPrefill" && tool.prefillMode === "native") {
      // Native Steam prefill
      const nativeService = new SteamPrefillService(job.id);
      jobManager.registerNativeJob(job.id, nativeService);
      // Fire-and-forget: events drive the SSE stream
      nativeService.startPrefill(appIds);
    } else {
      // CLI prefill (default)
      await jobManager.startJob(job.id, tool.executablePath, appIds, {
        ...flags,
        noAnsi: true,
      });
    }

    const fullJob = await prisma.prefillJob.findUnique({
      where: { id: job.id },
      include: {
        tool: true,
        games: { include: { game: true } },
      },
    });

    // Serialize BigInt fields for JSON response
    const serialized = JSON.parse(
      JSON.stringify(fullJob, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
