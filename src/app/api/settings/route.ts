import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const settingsSchema = z.object({
  lancachePath: z.string().optional(),
  enableScheduledJobs: z.boolean().optional(),
  defaultFlags: z.string().optional(),
  refreshInterval: z.number().optional(),
  connectionMode: z.enum(["local", "remote"]).optional(),
  sshHost: z.string().nullable().optional(),
  sshPort: z.number().min(1).max(65535).optional(),
  sshUsername: z.string().nullable().optional(),
  sshAuthMethod: z.enum(["key", "password"]).optional(),
  sshKeyPath: z.string().nullable().optional(),
  sshPassword: z.string().nullable().optional(),
  lancacheServerUrl: z.string().nullable().optional(),
  defaultScheduleTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  enableAutoUpdate: z.boolean().optional(),
  autoUpdateTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function GET() {
  let settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        id: "default",
        lancachePath: process.env.LANCACHE_PATH || "/data/cache/",
      },
    });
  }

  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const data = settingsSchema.parse(body);

    // Convert empty lancacheServerUrl to null
    const cleanedData = {
      ...data,
      lancacheServerUrl:
        data.lancacheServerUrl === "" ? null : data.lancacheServerUrl,
    };

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      create: { id: "default", ...cleanedData },
      update: cleanedData,
    });

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
