import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { assets } from "@/server/db/schema";
import { parseByteRange } from "@/server/byte-range";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset?.normalizedPath || asset.status !== "ready") {
    return NextResponse.json({ error: "素材を利用できません" }, { status: 404 });
  }
  const normalizedExtension = asset.normalizedPath.toLowerCase();
  const contentType =
    asset.kind === "video"
      ? normalizedExtension.endsWith(".webm")
        ? "video/webm"
        : "video/mp4"
      : asset.kind === "audio"
        ? "audio/mp4"
        : normalizedExtension.endsWith(".png")
          ? "image/png"
          : "image/jpeg";
  const fileSize = (await stat(asset.normalizedPath)).size;
  const rangeHeader = request.headers.get("range");
  const supportsRange = asset.kind === "video" || asset.kind === "audio";
  const range = supportsRange ? parseByteRange(rangeHeader, fileSize) : null;
  const commonHeaders = {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "accept-ranges, content-length, content-range",
  };

  if (supportsRange && rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { ...commonHeaders, "content-range": `bytes */${fileSize}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? fileSize - 1;
  const stream = createReadStream(asset.normalizedPath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: range ? 206 : 200,
    headers: {
      ...commonHeaders,
      "content-length": String(end - start + 1),
      ...(range ? { "content-range": `bytes ${start}-${end}/${fileSize}` } : {}),
    },
  });
}
