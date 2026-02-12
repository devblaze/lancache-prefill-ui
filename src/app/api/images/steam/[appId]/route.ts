import { NextRequest, NextResponse } from "next/server";
import { getCachedImage, downloadAndCache } from "@/lib/image-cache";

// Tiny 1x1 white JPEG placeholder
const PLACEHOLDER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA=",
  "base64"
);

function bufferToResponse(
  buf: Buffer,
  cacheControl: string
): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": cacheControl,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  if (!/^\d+$/.test(appId)) {
    return new NextResponse(null, { status: 400 });
  }

  const longCache = "public, max-age=604800, immutable";

  // 1. Try local cache
  const cached = await getCachedImage(appId);
  if (cached) {
    return bufferToResponse(cached, longCache);
  }

  // 2. Try downloading from CDN and caching
  const downloaded = await downloadAndCache(appId);
  if (downloaded) {
    return bufferToResponse(downloaded, longCache);
  }

  // 3. Return placeholder (short cache so browser retries soon)
  return bufferToResponse(PLACEHOLDER, "public, max-age=60");
}
