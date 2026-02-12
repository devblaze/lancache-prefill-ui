# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

lancache-prefill-ui — a web UI for managing lancache prefill operations across Steam, Battle.net, and Epic Games. Wraps the CLI tools (SteamPrefill, BattleNetPrefill, EpicPrefill) as subprocesses and provides real-time progress via SSE.

Built with Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Prisma 7 + SQLite.

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint (flat config, Next.js core-web-vitals + TypeScript presets)
- `npm run db:seed` — seed database with default tools and settings
- `npm run db:migrate` — run Prisma migrations
- `npm run db:studio` — open Prisma Studio

No test framework is configured yet.

## Architecture

- **App Router** with file-system routing in `src/app/`
- **Server Components** by default; Client Components marked with `"use client"` for interactive parts
- **Path alias**: `@/*` → `./src/*`
- **Styling**: Tailwind CSS 4 with inline theme config in `src/app/globals.css`. Dark mode via `prefers-color-scheme`.
- **ESLint 9**: flat config format (`eslint.config.mjs`)

### Database (Prisma 7 + SQLite)

- Schema: `prisma/schema.prisma`
- Config: `prisma.config.ts` (Prisma 7 style — connection URL lives here, not in schema)
- Generated client: `generated/prisma/` (gitignored, regenerate with `npx prisma generate`)
- Singleton: `src/lib/prisma.ts` uses `@prisma/adapter-better-sqlite3`
- Models: PrefillTool, Game, PrefillJob, PrefillJobGame, PrefillJobLog, Settings
- Seed: `prisma/seed.ts` — creates 3 default tools (Steam, Battle.net, Epic) and default settings

### Backend Services

- `src/lib/prefill-service.ts` — **PrefillService** (EventEmitter) wraps CLI tools via `child_process.spawn` with `--no-ansi`, parses stdout with regex. **JobManager** singleton tracks active jobs.
- `src/lib/cache-analyzer.ts` — reads lancache NGINX cache directory for stats
- `src/lib/utils.ts` — `formatBytes()`, `parseSize()`, `cn()` (clsx wrapper)

### API Routes (`src/app/api/`)

| Route | Purpose |
|---|---|
| `/api/tools` | CRUD for prefill tool registrations |
| `/api/games` | List games with filters (toolId, cached, search) |
| `/api/games/sync` | Sync game library from CLI tool |
| `/api/jobs` | List/create prefill jobs |
| `/api/jobs/[id]` | Job details with logs |
| `/api/jobs/[id]/cancel` | Cancel running job |
| `/api/jobs/[id]/events` | **SSE stream** for real-time progress |
| `/api/settings` | Read/update settings |
| `/api/cache/stats` | Cache size and game counts |
| `/api/cache/refresh` | Re-scan cache status |

All write routes validate with zod (`zod/v4` import).

### Pages

- `/dashboard` — stats cards, tool status, recent jobs (Server Component)
- `/games` — game library with search/filter/select + bulk prefill (Client Component)
- `/jobs` — job history list (Client Component)
- `/jobs/[id]` — job detail with SSE progress bars and log viewer
- `/settings` — general settings + per-tool config with sync button

### Custom Hooks

- `src/hooks/use-sse.ts` — EventSource wrapper for SSE events
- `src/hooks/use-jobs.ts` — fetch/create/cancel jobs

### Key Patterns

- BigInt fields from Prisma are serialized to strings before passing to Client Components
- SSE events: `connected`, `progress`, `log`, `game-complete`, `game-error`, `complete`, `error`
- CLI tool output parsed with `--no-ansi` flag for plain text
