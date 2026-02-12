"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface PrefillDialogProps {
  gameIds: string[];
  tools: Array<{ id: string; displayName: string }>;
  selectedToolId: string | null;
  onClose: () => void;
  onSubmit: (toolId: string, flags: { force: boolean; verbose: boolean }) => void;
  loading: boolean;
}

export function PrefillDialog({
  gameIds,
  tools,
  selectedToolId,
  onClose,
  onSubmit,
  loading,
}: PrefillDialogProps) {
  const [toolId, setToolId] = useState(selectedToolId || "");
  const [force, setForce] = useState(false);
  const [verbose, setVerbose] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (toolId) {
      onSubmit(toolId, { force, verbose });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Start Prefill Job</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {gameIds.length} game{gameIds.length !== 1 && "s"} selected for prefill
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Platform Tool
            </label>
            <select
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Select a tool...</option>
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Force re-download (--force)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={verbose}
                onChange={(e) => setVerbose(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Verbose output (--verbose)</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !toolId}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Starting..." : "Start Prefill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
