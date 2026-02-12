"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle, Circle, HardDrive, Gamepad2, Package } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { getGameImageUrl } from "@/lib/image-url";

interface GameCardProps {
  game: {
    id: string;
    appId: string;
    name: string;
    sizeBytes: string | bigint | null;
    depots: string | null;
    isCached: boolean;
    lastChecked: string | null;
    tool: {
      displayName: string;
    };
  };
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function GameCard({ game, isSelected, onToggleSelect }: GameCardProps) {
  const [imgError, setImgError] = useState(false);
  const isSteam = game.tool.displayName === "Steam";
  const hasSize = game.sizeBytes !== null && game.sizeBytes !== undefined;
  const depotCount = game.depots ? (JSON.parse(game.depots) as string[]).length : 0;

  return (
    <div
      onClick={onToggleSelect}
      className={`relative cursor-pointer overflow-hidden rounded-lg border transition-all ${
        isSelected
          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/20 dark:bg-blue-900/20"
          : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Game image */}
      <div className="relative aspect-[460/215] w-full bg-zinc-100 dark:bg-zinc-800">
        {isSteam && !imgError ? (
          <Image
            src={getGameImageUrl(game.appId, game.tool.displayName)}
            alt={game.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gamepad2 className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          </div>
        )}
        {/* Selection indicator overlay */}
        <div className="absolute right-2 top-2">
          {isSelected ? (
            <CheckCircle className="h-6 w-6 text-blue-600 drop-shadow-md" />
          ) : (
            <Circle className="h-6 w-6 text-white/70 drop-shadow-md" />
          )}
        </div>
        {/* Cache status badge overlay */}
        <div className="absolute left-2 top-2">
          {game.isCached ? (
            <span className="rounded bg-green-600/90 px-2 py-0.5 text-xs font-medium text-white">
              Cached
            </span>
          ) : (
            <span className="rounded bg-zinc-800/70 px-2 py-0.5 text-xs font-medium text-white">
              Not Cached
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-medium">{game.name}</h3>
        <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{game.tool.displayName}</span>
          {hasSize && (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatBytes(typeof game.sizeBytes === "string" ? BigInt(game.sizeBytes) : game.sizeBytes)}
            </span>
          )}
        </div>
        {(depotCount > 0 || game.lastChecked) && (
          <div className="mt-1 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
            {depotCount > 0 ? (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {depotCount} depot{depotCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span />
            )}
            {game.lastChecked && (
              <span title={new Date(game.lastChecked).toLocaleString()}>
                Checked {formatRelativeDate(game.lastChecked)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
