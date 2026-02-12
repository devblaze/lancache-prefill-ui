"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Download } from "lucide-react";
import { GameCard } from "./game-card";
import { PrefillDialog } from "./prefill-dialog";

interface Game {
  id: string;
  appId: string;
  name: string;
  sizeBytes: string | bigint | null;
  depots: string | null;
  isCached: boolean;
  lastChecked: string | null;
  toolId: string;
  tool: {
    id: string;
    displayName: string;
  };
}

interface ScheduleConfig {
  type: "one-time" | "recurring";
  scheduledAt?: string;
  cronExpression?: string;
}

interface GameLibraryProps {
  initialGames: Game[];
  tools: Array<{ id: string; displayName: string }>;
  defaultScheduleTime?: string;
}

export function GameLibrary({ initialGames, tools, defaultScheduleTime }: GameLibraryProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<string>("all");
  const [cachedFilter, setCachedFilter] = useState<
    "all" | "cached" | "uncached"
  >("all");
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [showPrefillDialog, setShowPrefillDialog] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const filteredGames = useMemo(() => {
    return initialGames.filter((game) => {
      const matchesSearch = game.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesTool =
        selectedTool === "all" || game.tool.id === selectedTool;
      const matchesCached =
        cachedFilter === "all" ||
        (cachedFilter === "cached" && game.isCached) ||
        (cachedFilter === "uncached" && !game.isCached);

      return matchesSearch && matchesTool && matchesCached;
    });
  }, [initialGames, search, selectedTool, cachedFilter]);

  const toggleGameSelection = (gameId: string) => {
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  // Determine tool from selected games
  const selectedToolId = useMemo(() => {
    if (selectedGames.size === 0) return null;
    const firstGame = initialGames.find((g) =>
      selectedGames.has(g.id)
    );
    return firstGame?.toolId || null;
  }, [selectedGames, initialGames]);

  const handlePrefillSubmit = async (
    toolId: string,
    flags: { force: boolean; verbose: boolean },
    scheduleConfig?: ScheduleConfig
  ) => {
    setPrefillLoading(true);
    try {
      if (scheduleConfig) {
        // Create a schedule instead of an immediate job
        const response = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolId,
            gameIds: Array.from(selectedGames),
            type: scheduleConfig.type,
            scheduledAt: scheduleConfig.scheduledAt,
            cronExpression: scheduleConfig.cronExpression,
            flags,
          }),
        });

        if (response.ok) {
          setSelectedGames(new Set());
          setShowPrefillDialog(false);
          router.push("/schedules");
        }
      } else {
        // Run immediately — existing behavior
        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolId,
            gameIds: Array.from(selectedGames),
            flags,
          }),
        });

        if (response.ok) {
          const job = await response.json();
          setSelectedGames(new Set());
          setShowPrefillDialog(false);
          router.push(`/jobs/${job.id}`);
        }
      }
    } catch (error) {
      console.error("Failed to start prefill:", error);
    } finally {
      setPrefillLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search and Filters — sticky below navbar */}
        <div className="sticky top-16 z-30 -mx-4 bg-zinc-50/95 px-4 py-3 backdrop-blur-sm dark:bg-zinc-950/95 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search games..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">All Platforms</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.displayName}
                </option>
              ))}
            </select>

            <select
              value={cachedFilter}
              onChange={(e) =>
                setCachedFilter(e.target.value as "all" | "cached" | "uncached")
              }
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">All Games</option>
              <option value="cached">Cached Only</option>
              <option value="uncached">Not Cached</option>
            </select>
          </div>
        </div>

        {/* Spacer for sticky bar */}
        {selectedGames.size > 0 && <div className="h-16" />}

        {/* Games Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isSelected={selectedGames.has(game.id)}
              onToggleSelect={() => toggleGameSelection(game.id)}
            />
          ))}
        </div>

        {filteredGames.length === 0 && (
          <p className="py-12 text-center text-zinc-500">
            {initialGames.length === 0
              ? "No games found. Sync your game library from Settings."
              : "No games found matching your criteria."}
          </p>
        )}
      </div>

      {/* Sticky Selection Action Bar */}
      {selectedGames.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-sm font-medium">
              {selectedGames.size} game{selectedGames.size !== 1 && "s"} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedGames(new Set())}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
              <button
                onClick={() => setShowPrefillDialog(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Prefill Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrefillDialog && (
        <PrefillDialog
          gameIds={Array.from(selectedGames)}
          tools={tools}
          selectedToolId={selectedToolId}
          defaultScheduleTime={defaultScheduleTime}
          onClose={() => setShowPrefillDialog(false)}
          onSubmit={handlePrefillSubmit}
          loading={prefillLoading}
        />
      )}
    </>
  );
}
