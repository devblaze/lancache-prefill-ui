-- CreateTable
CREATE TABLE "game_ownerships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "steamAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_ownerships_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_ownerships_steamAccountId_fkey" FOREIGN KEY ("steamAccountId") REFERENCES "steam_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_steam_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "refreshToken" TEXT,
    "steamId" TEXT,
    "displayName" TEXT,
    "isLoggedIn" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_steam_accounts" ("createdAt", "displayName", "id", "isLoggedIn", "lastLogin", "refreshToken", "steamId", "updatedAt", "username") SELECT "createdAt", "displayName", "id", "isLoggedIn", "lastLogin", "refreshToken", "steamId", "updatedAt", "username" FROM "steam_accounts";
DROP TABLE "steam_accounts";
ALTER TABLE "new_steam_accounts" RENAME TO "steam_accounts";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "game_ownerships_steamAccountId_idx" ON "game_ownerships"("steamAccountId");

-- CreateIndex
CREATE INDEX "game_ownerships_gameId_idx" ON "game_ownerships"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "game_ownerships_gameId_steamAccountId_key" ON "game_ownerships"("gameId", "steamAccountId");
