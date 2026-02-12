import { NextRequest, NextResponse } from "next/server";
import { JobManager } from "@/lib/prefill-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobManager = JobManager.getInstance();
    await jobManager.cancelJob(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}
