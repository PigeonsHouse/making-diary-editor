import path from "node:path";
import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {z} from "zod";
import {db} from "@/server/db";
import {assets} from "@/server/db/schema";
import {readPsdGroups, renderPsdPreview} from "@/server/psd";

type Context = {params: Promise<{assetId: string}>};

async function getAsset(id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset || asset.kind !== "psd" || asset.status !== "ready") throw new Error("PSDを利用できません");
  return asset;
}

export async function GET(_: Request, context: Context) {
  try {
    const asset = await getAsset((await context.params).assetId);
    return NextResponse.json({groups: await readPsdGroups(asset.originalPath)});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : "PSD解析に失敗しました"}, {status: 400});
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const asset = await getAsset((await context.params).assetId);
    const selections = z.record(z.string(), z.string()).parse((await request.json()).selections);
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    const hash = await renderPsdPreview(asset.originalPath, selections, path.join(dataDir, "psd-previews"));
    return NextResponse.json({url: `/api/files/psd/${hash}.png`});
  } catch (error) {
    return NextResponse.json({error: error instanceof Error ? error.message : "PSD合成に失敗しました"}, {status: 400});
  }
}
