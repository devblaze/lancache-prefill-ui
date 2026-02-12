import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      lancachePath: process.env.LANCACHE_PATH || "/data/cache/",
    },
    update: {},
  });

  const tools = [
    {
      name: "SteamPrefill",
      displayName: "Steam",
      executablePath:
        process.env.STEAM_PREFILL_PATH || "/usr/local/bin/SteamPrefill",
      configPath: "~/.config/SteamPrefill/",
    },
    {
      name: "BattleNetPrefill",
      displayName: "Battle.net",
      executablePath:
        process.env.BATTLENET_PREFILL_PATH ||
        "/usr/local/bin/BattleNetPrefill",
      configPath: "~/.config/BattleNetPrefill/",
    },
    {
      name: "EpicPrefill",
      displayName: "Epic Games",
      executablePath:
        process.env.EPIC_PREFILL_PATH || "/usr/local/bin/EpicPrefill",
      configPath: "~/.config/EpicPrefill/",
    },
  ];

  for (const tool of tools) {
    await prisma.prefillTool.upsert({
      where: { name: tool.name },
      create: { ...tool, prefillMode: "cli" },
      update: tool,
    });
  }

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
