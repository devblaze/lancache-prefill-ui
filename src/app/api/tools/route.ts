import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const toolSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  executablePath: z.string(),
  configPath: z.string().optional(),
  isEnabled: z.boolean().default(true),
});

export async function GET() {
  const tools = await prisma.prefillTool.findMany({
    include: {
      _count: {
        select: { games: true },
      },
    },
  });

  return NextResponse.json(tools);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = toolSchema.parse(body);

    const tool = await prisma.prefillTool.create({ data });

    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create tool" },
      { status: 500 }
    );
  }
}
