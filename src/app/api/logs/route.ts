import { NextRequest, NextResponse } from "next/server";
import { appLog } from "@/lib/app-logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sinceId = parseInt(searchParams.get("since") || "0", 10);
  const level = searchParams.get("level");
  const source = searchParams.get("source");

  let logs = sinceId > 0 ? appLog.getSince(sinceId) : appLog.getAll();

  if (level) {
    logs = logs.filter((l) => l.level === level);
  }
  if (source) {
    logs = logs.filter((l) => l.source === source);
  }

  return NextResponse.json({ logs });
}

export async function DELETE() {
  appLog.clear();
  return NextResponse.json({ success: true });
}
