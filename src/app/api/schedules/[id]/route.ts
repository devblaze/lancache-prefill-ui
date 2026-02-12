import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { CronExpressionParser } from "cron-parser";

const updateScheduleSchema = z.object({
  name: z.string().optional(),
  isEnabled: z.boolean().optional(),
  cronExpression: z.string().optional(),
  scheduledAt: z.string().optional(),
  flags: z
    .object({
      force: z.boolean().optional(),
      verbose: z.boolean().optional(),
    })
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      tool: true,
      games: { include: { game: true } },
      jobs: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  const serialized = JSON.parse(
    JSON.stringify(schedule, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json(serialized);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateScheduleSchema.parse(body);

    const schedule = await prisma.schedule.findUnique({ where: { id } });
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.flags !== undefined) updateData.flags = JSON.stringify(data.flags);

    if (data.cronExpression !== undefined) {
      updateData.cronExpression = data.cronExpression;
      try {
        const interval = CronExpressionParser.parse(data.cronExpression);
        updateData.nextRunAt = interval.next().toDate();
      } catch {
        return NextResponse.json(
          { error: "Invalid cron expression" },
          { status: 400 }
        );
      }
    }

    if (data.scheduledAt !== undefined) {
      const scheduledDate = new Date(data.scheduledAt);
      updateData.scheduledAt = scheduledDate;
      updateData.nextRunAt = scheduledDate;
    }

    // If re-enabling a recurring schedule, recompute nextRunAt
    if (
      data.isEnabled === true &&
      !schedule.isEnabled &&
      schedule.type === "recurring" &&
      schedule.cronExpression
    ) {
      const cron = data.cronExpression || schedule.cronExpression;
      try {
        const interval = CronExpressionParser.parse(cron);
        updateData.nextRunAt = interval.next().toDate();
      } catch {
        // Keep existing nextRunAt
      }
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        tool: true,
        games: { include: { game: true } },
      },
    });

    const serialized = JSON.parse(
      JSON.stringify(updated, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }
}
