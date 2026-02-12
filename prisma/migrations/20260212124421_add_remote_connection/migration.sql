-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "lancachePath" TEXT NOT NULL DEFAULT '/data/cache/',
    "enableScheduledJobs" BOOLEAN NOT NULL DEFAULT false,
    "defaultFlags" TEXT,
    "refreshInterval" INTEGER NOT NULL DEFAULT 3600,
    "connectionMode" TEXT NOT NULL DEFAULT 'local',
    "sshHost" TEXT,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "sshUsername" TEXT,
    "sshAuthMethod" TEXT NOT NULL DEFAULT 'key',
    "sshKeyPath" TEXT,
    "sshPassword" TEXT,
    "lancacheServerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_settings" ("createdAt", "defaultFlags", "enableScheduledJobs", "id", "lancachePath", "refreshInterval", "updatedAt") SELECT "createdAt", "defaultFlags", "enableScheduledJobs", "id", "lancachePath", "refreshInterval", "updatedAt" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
