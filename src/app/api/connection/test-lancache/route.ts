import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkLancacheHealth } from "@/lib/lancache-health";

export async function POST() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings || !settings.lancacheServerUrl) {
      return NextResponse.json(
        { success: false, error: "Lancache server URL not configured." },
        { status: 400 }
      );
    }

    const result = await checkLancacheHealth(settings.lancacheServerUrl);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to check lancache health" },
      { status: 500 }
    );
  }
}
