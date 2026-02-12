import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const updateSchema = z.object({
  displayName: z.string().optional(),
  executablePath: z.string().optional(),
  configPath: z.string().optional(),
  isEnabled: z.boolean().optional(),
  isConfigured: z.boolean().optional(),
  prefillMode: z.enum(["cli", "native"]).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tool = await prisma.prefillTool.findUnique({
    where: { id },
    include: {
      games: { orderBy: { name: "asc" } },
    },
  });

  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  return NextResponse.json(tool);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const tool = await prisma.prefillTool.update({
      where: { id },
      data,
    });

    return NextResponse.json(tool);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update tool" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.prefillTool.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
