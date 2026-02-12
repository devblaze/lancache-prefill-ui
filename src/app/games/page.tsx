import { prisma } from "@/lib/prisma";
import { GameLibrary } from "@/components/games/game-library";

export default async function GamesPage() {
  const [games, tools, settings] = await Promise.all([
    prisma.game.findMany({
      include: { tool: true },
      orderBy: { name: "asc" },
    }),
    prisma.prefillTool.findMany({
      select: { id: true, displayName: true },
    }),
    prisma.settings.findUnique({
      where: { id: "default" },
      select: { defaultScheduleTime: true },
    }),
  ]);

  // Serialize BigInt for client component
  const serializedGames = games.map((game) => ({
    ...game,
    sizeBytes: game.sizeBytes ? game.sizeBytes.toString() : null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    lastChecked: game.lastChecked?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Game Library</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Browse and manage games across all platforms
        </p>
      </div>

      <GameLibrary
        initialGames={serializedGames}
        tools={tools}
        defaultScheduleTime={settings?.defaultScheduleTime ?? "01:00"}
      />
    </div>
  );
}
