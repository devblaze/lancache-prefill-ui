import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { JobDetails } from "@/components/jobs/job-details";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.prefillJob.findUnique({
    where: { id },
    include: {
      tool: true,
      games: {
        include: { game: true },
      },
      logs: {
        orderBy: { timestamp: "asc" },
        take: 500,
      },
    },
  });

  if (!job) {
    notFound();
  }

  // Serialize for client component
  const serializedJob = {
    ...job,
    totalBytes: job.totalBytes.toString(),
    downloadedBytes: job.downloadedBytes.toString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    games: job.games.map((g) => ({
      ...g,
      sizeBytes: g.sizeBytes?.toString() ?? null,
      downloadedBytes: g.downloadedBytes.toString(),
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
    logs: job.logs.map((l) => ({
      ...l,
      timestamp: l.timestamp.toISOString(),
    })),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Job Details</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {job.tool.displayName} &middot; {job.games.length} game
          {job.games.length !== 1 && "s"}
        </p>
      </div>

      <JobDetails job={serializedJob} />
    </div>
  );
}
