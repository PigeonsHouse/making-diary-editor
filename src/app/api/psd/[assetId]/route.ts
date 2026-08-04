import path from "node:path";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { assets } from "@/server/db/schema";
import { readPsdTree, renderPsdPreview } from "@/server/psd";

type Context = { params: Promise<{ assetId: string }> };

async function getAsset(id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset || !asset.originalName.toLowerCase().endsWith(".psd")) {
    throw new Error("PSDを利用できません");
  }
  if (asset.kind !== "psd" || asset.status !== "ready") {
    const [repaired] = await db
      .update(assets)
      .set({
        kind: "psd",
        status: "ready",
        normalizedPath: asset.originalPath,
        error: null,
      })
      .where(eq(assets.id, id))
      .returning();
    return repaired;
  }
  return asset;
}

export async function GET(_: Request, context: Context) {
  try {
    const asset = await getAsset((await context.params).assetId);
    return NextResponse.json({ tree: await readPsdTree(asset.originalPath) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PSD解析に失敗しました" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const asset = await getAsset((await context.params).assetId);
    const body = await request.json();
    const selections = z.record(z.string(), z.string()).parse(body.selections);
    const filters = z
      .record(
        z.string(),
        z.object({
          targets: z.array(z.string()),
          choiceOrder: z.array(z.string()).optional(),
          choices: z.record(z.string(), z.object({ show: z.array(z.string()), hide: z.array(z.string()).optional() })),
        }),
      )
      .parse(body.filters);
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    const hash = await renderPsdPreview(
      asset.originalPath,
      filters,
      selections,
      path.join(dataDir, "psd-previews"),
      asset.id,
    );
    return NextResponse.json({ url: `/api/files/psd/${hash}.png` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PSD合成に失敗しました" },
      { status: 400 },
    );
  }
}
