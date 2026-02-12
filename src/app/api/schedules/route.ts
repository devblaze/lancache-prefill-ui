import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { CronExpressionParser } from "cron-parser";

const createScheduleSchema = z.object({
  name: z.string().optional(),
  toolId: z.string(),
  gameIds: z.array(z.string()).min(1),
  type: z.enum(["one-time", "recurring"]),
  scheduledAt: z.string().optional(),
  cronExpression: z.string().optional(),
  flags: z
    .object({
      force: z.boolean().optional(),
      verbose: z.boolean().optional(),
      unit: z.enum(["bits", "bytes"]).optional(),
    })
    .optional(),
});

export async function GET() {
  const schedules = await prisma.schedule.findMany({
    include: {
      tool: true,
      games: { include: { game: true } },
      jobs: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = JSON.parse(
    JSON.stringify(schedules, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json(serialized);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, toolId, gameIds, type, scheduledAt, cronExpression, flags } =
      createScheduleSchema.parse(body);

    // Validate tool exists
    const tool = await prisma.prefillTool.findUnique({
      where: { id: toolId },
    });
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Compute nextRunAt
    let nextRunAt: Date | null = null;

    if (type === "one-time") {
      if (!scheduledAt) {
        return NextResponse.json(
          { error: "scheduledAt is required for one-time schedules" },
          { status: 400 }
        );
      }
      nextRunAt = new Date(scheduledAt);
      if (nextRunAt <= new Date()) {
        return NextResponse.json(
          { error: "scheduledAt must be in the future" },
          { status: 400 }
        );
      }
    } else if (type === "recurring") {
      if (!cronExpression) {
        return NextResponse.json(
          { error: "cronExpression is required for recurring schedules" },
          { status: 400 }
        );
      }
      try {
        const interval = CronExpressionParser.parse(cronExpression);
        nextRunAt = interval.next().toDate();
      } catch {
        return NextResponse.json(
          { error: "Invalid cron expression" },
          { status: 400 }
        );
      }
    }

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        name: name || null,
        toolId,
        type,
        cronExpression: cronExpression || null,
        scheduledAt: type === "one-time" && scheduledAt ? new Date(scheduledAt) : null,
        flags: flags ? JSON.stringify(flags) : null,
        nextRunAt,
      },
    });

    // Link games
    const games = await prisma.game.findMany({
      where: { id: { in: gameIds } },
    });

    for (const game of games) {
      await prisma.scheduleGame.create({
        data: {
          scheduleId: schedule.id,
          gameId: game.id,
        },
      });
    }

    // Fetch the full schedule with relations
    const fullSchedule = await prisma.schedule.findUnique({
      where: { id: schedule.id },
      include: {
        tool: true,
        games: { include: { game: true } },
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(fullSchedule, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
