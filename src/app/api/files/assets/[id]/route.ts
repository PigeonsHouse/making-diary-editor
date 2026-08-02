import {readFile} from "node:fs/promises";
import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {db} from "@/server/db";
import {assets} from "@/server/db/schema";

type Context = {params: Promise<{id: string}>};

export async function GET(_: Request, context: Context) {
  const {id} = await context.params;
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset?.normalizedPath || asset.status !== "ready") {
    return NextResponse.json({error: "素材を利用できません"}, {status: 404});
  }
  const content = await readFile(asset.normalizedPath);
  const contentType =
    asset.kind === "video" ? "video/mp4" : asset.normalizedPath.endsWith(".png") ? "image/png" : "image/jpeg";
  return new NextResponse(content, {
    headers: {"content-type": contentType, "cache-control": "public, max-age=31536000, immutable"},
  });
}
