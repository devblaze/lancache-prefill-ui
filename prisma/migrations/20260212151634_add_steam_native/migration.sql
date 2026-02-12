-- CreateTable
CREATE TABLE "steam_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "username" TEXT,
    "refreshToken" TEXT,
    "steamId" TEXT,
    "displayName" TEXT,
    "isLoggedIn" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_prefill_tools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "executablePath" TEXT NOT NULL,
    "configPath" TEXT,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "prefillMode" TEXT NOT NULL DEFAULT 'cli',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_prefill_tools" ("configPath", "createdAt", "displayName", "executablePath", "id", "isConfigured", "isEnabled", "name", "updatedAt") SELECT "configPath", "createdAt", "displayName", "executablePath", "id", "isConfigured", "isEnabled", "name", "updatedAt" FROM "prefill_tools";
DROP TABLE "prefill_tools";
ALTER TABLE "new_prefill_tools" RENAME TO "prefill_tools";
CREATE UNIQUE INDEX "prefill_tools_name_key" ON "prefill_tools"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
