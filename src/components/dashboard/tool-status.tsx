import { CheckCircle, XCircle } from "lucide-react";

interface ToolStatusProps {
  tools: Array<{
    id: string;
    name: string;
    displayName: string;
    isConfigured: boolean;
    isEnabled: boolean;
    _count: { games: number };
  }>;
}

export function ToolStatus({ tools }: ToolStatusProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-semibold">Prefill Tools</h2>
      <div className="space-y-3">
        {tools.length === 0 ? (
          <p className="py-4 text-center text-zinc-500">
            No tools registered yet.
          </p>
        ) : (
          tools.map((tool) => {
            const configured = tool.isConfigured || tool._count.games > 0;
            return (
              <div
                key={tool.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800"
              >
                <div className="flex items-center gap-3">
                  {configured ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-zinc-400" />
                  )}
                  <div>
                    <p className="font-medium">{tool.displayName}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {tool._count.games} game{tool._count.games !== 1 && "s"}
                    </p>
                  </div>
                </div>
                <div className="text-sm">
                  {configured ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900 dark:text-green-300">
                      Configured
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      Not Configured
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
