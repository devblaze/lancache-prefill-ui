import { prisma } from "@/lib/prisma";
import { DashboardStats } from "@/components/dashboard/stats";
import { RecentJobs } from "@/components/dashboard/recent-jobs";
import { ToolStatus } from "@/components/dashboard/tool-status";
import { ConnectionStatus } from "@/components/dashboard/connection-status";
import { UpcomingSchedules } from "@/components/dashboard/upcoming-schedules";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [tools, recentJobs, settings, upcomingSchedules] = await Promise.all([
    prisma.prefillTool.findMany({
      include: {
        _count: {
          select: { games: true },
        },
      },
    }),
    prisma.prefillJob.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        tool: true,
        games: {
          include: { game: true },
        },
      },
    }),
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.schedule.findMany({
      where: { isEnabled: true, nextRunAt: { not: null } },
      orderBy: { nextRunAt: "asc" },
      take: 5,
      include: {
        tool: true,
        games: { select: { id: true } },
      },
    }),
  ]);

  const serializedSchedules = JSON.parse(
    JSON.stringify(upcomingSchedules, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Overview of your lancache prefill operations
        </p>
      </div>

      <DashboardStats />
      <ConnectionStatus
        connectionMode={settings?.connectionMode || "local"}
        lancacheServerUrl={settings?.lancacheServerUrl || null}
        sshHost={settings?.sshHost || null}
      />
      <RecentJobs jobs={recentJobs} />
      <UpcomingSchedules schedules={serializedSchedules} />
      <ToolStatus tools={tools} />
    </div>
  );
}
