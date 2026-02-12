import { promises as fs } from "fs";
import path from "path";
import { appLog } from "./app-logger";

const CACHE_DIR =
  process.env.IMAGE_CACHE_PATH ||
  path.join(process.cwd(), "data", "image-cache");

function imagePath(appId: string): string {
  const safeId = appId.replace(/[^0-9]/g, "");
  return path.join(CACHE_DIR, `${safeId}.jpg`);
}

export async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

export async function getCachedImage(appId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(imagePath(appId));
  } catch {
    return null;
  }
}

export async function cacheImage(appId: string, data: Buffer): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(imagePath(appId), data);
}

export async function downloadAndCache(
  appId: string
): Promise<Buffer | null> {
  const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    await cacheImage(appId, buffer);
    appLog.debug("ImageCache", `Cached image for appId ${appId}`);
    return buffer;
  } catch (err) {
    appLog.debug(
      "ImageCache",
      `Failed to download image for appId ${appId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}
