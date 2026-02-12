-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "toolId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'one-time',
    "cronExpression" TEXT,
    "scheduledAt" DATETIME,
    "flags" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "schedules_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "prefill_tools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_games_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedule_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_prefill_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "downloadedBytes" BIGINT NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "flags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduleId" TEXT,
    CONSTRAINT "prefill_jobs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "prefill_tools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prefill_jobs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_prefill_jobs" ("completedAt", "createdAt", "downloadedBytes", "errorMessage", "flags", "id", "startedAt", "status", "toolId", "totalBytes", "updatedAt") SELECT "completedAt", "createdAt", "downloadedBytes", "errorMessage", "flags", "id", "startedAt", "status", "toolId", "totalBytes", "updatedAt" FROM "prefill_jobs";
DROP TABLE "prefill_jobs";
ALTER TABLE "new_prefill_jobs" RENAME TO "prefill_jobs";
CREATE INDEX "prefill_jobs_status_idx" ON "prefill_jobs"("status");
CREATE INDEX "prefill_jobs_createdAt_idx" ON "prefill_jobs"("createdAt");
CREATE INDEX "prefill_jobs_scheduleId_idx" ON "prefill_jobs"("scheduleId");
CREATE TABLE "new_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "lancachePath" TEXT NOT NULL DEFAULT '/data/cache/',
    "enableScheduledJobs" BOOLEAN NOT NULL DEFAULT false,
    "defaultFlags" TEXT,
    "refreshInterval" INTEGER NOT NULL DEFAULT 3600,
    "defaultScheduleTime" TEXT NOT NULL DEFAULT '01:00',
    "enableAutoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdateTime" TEXT NOT NULL DEFAULT '03:00',
    "connectionMode" TEXT NOT NULL DEFAULT 'local',
    "sshHost" TEXT,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "sshUsername" TEXT,
    "sshAuthMethod" TEXT NOT NULL DEFAULT 'key',
    "sshKeyPath" TEXT,
    "sshPassword" TEXT,
    "lancacheServerUrl" TEXT,
    "cacheStatsData" TEXT,
    "cacheStatsUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_settings" ("cacheStatsData", "cacheStatsUpdatedAt", "connectionMode", "createdAt", "defaultFlags", "enableScheduledJobs", "id", "lancachePath", "lancacheServerUrl", "refreshInterval", "sshAuthMethod", "sshHost", "sshKeyPath", "sshPassword", "sshPort", "sshUsername", "updatedAt") SELECT "cacheStatsData", "cacheStatsUpdatedAt", "connectionMode", "createdAt", "defaultFlags", "enableScheduledJobs", "id", "lancachePath", "lancacheServerUrl", "refreshInterval", "sshAuthMethod", "sshHost", "sshKeyPath", "sshPassword", "sshPort", "sshUsername", "updatedAt" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "schedules_isEnabled_idx" ON "schedules"("isEnabled");

-- CreateIndex
CREATE INDEX "schedules_nextRunAt_idx" ON "schedules"("nextRunAt");

-- CreateIndex
CREATE INDEX "schedule_games_scheduleId_idx" ON "schedule_games"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_games_scheduleId_gameId_key" ON "schedule_games"("scheduleId", "gameId");
