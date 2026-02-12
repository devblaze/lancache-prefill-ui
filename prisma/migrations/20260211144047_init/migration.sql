-- CreateTable
CREATE TABLE "prefill_tools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "executablePath" TEXT NOT NULL,
    "configPath" TEXT,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toolId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "lastChecked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "games_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "prefill_tools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prefill_jobs" (
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
    CONSTRAINT "prefill_jobs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "prefill_tools" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prefill_job_games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" REAL NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT,
    "downloadedBytes" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "prefill_job_games_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "prefill_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prefill_job_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prefill_job_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prefill_job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "prefill_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "lancachePath" TEXT NOT NULL DEFAULT '/data/cache/',
    "enableScheduledJobs" BOOLEAN NOT NULL DEFAULT false,
    "defaultFlags" TEXT,
    "refreshInterval" INTEGER NOT NULL DEFAULT 3600,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "prefill_tools_name_key" ON "prefill_tools"("name");

-- CreateIndex
CREATE INDEX "games_toolId_idx" ON "games"("toolId");

-- CreateIndex
CREATE INDEX "games_isCached_idx" ON "games"("isCached");

-- CreateIndex
CREATE UNIQUE INDEX "games_toolId_appId_key" ON "games"("toolId", "appId");

-- CreateIndex
CREATE INDEX "prefill_jobs_status_idx" ON "prefill_jobs"("status");

-- CreateIndex
CREATE INDEX "prefill_jobs_createdAt_idx" ON "prefill_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "prefill_job_games_jobId_idx" ON "prefill_job_games"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "prefill_job_games_jobId_gameId_key" ON "prefill_job_games"("jobId", "gameId");

-- CreateIndex
CREATE INDEX "prefill_job_logs_jobId_idx" ON "prefill_job_logs"("jobId");

-- CreateIndex
CREATE INDEX "prefill_job_logs_timestamp_idx" ON "prefill_job_logs"("timestamp");
