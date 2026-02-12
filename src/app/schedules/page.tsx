import { prisma } from "@/lib/prisma";
import { SchedulesList } from "@/components/schedules/schedules-list";

export default async function SchedulesPage() {
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

  // Serialize BigInt and Date fields for client component
  const serialized = JSON.parse(
    JSON.stringify(schedules, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Schedules</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage scheduled and recurring prefill jobs
        </p>
      </div>

      <SchedulesList initialSchedules={serialized} />
    </div>
  );
}
