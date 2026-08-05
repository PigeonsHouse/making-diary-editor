import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { assets, projects } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { assetQueue } from "@/server/queue";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    const rows = projectId
      ? await db
          .select()
          .from(assets)
          .where(or(isNull(assets.projectId), eq(assets.projectId, projectId)))
          .orderBy(asc(assets.originalName))
      : await db.select().from(assets).where(isNull(assets.projectId)).orderBy(asc(assets.originalName));
    return NextResponse.json(rows);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }
    const requestedProjectId = form.get("projectId");
    const projectId = typeof requestedProjectId === "string" && requestedProjectId ? requestedProjectId : null;
    if (projectId) {
      const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId));
      if (!project) return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }
    const kind = file.name.toLowerCase().endsWith(".psd")
      ? "psd"
      : file.type.startsWith("audio/")
        ? "audio"
        : file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : null;
    if (!kind) return NextResponse.json({ error: "画像、動画、音声、PSDだけアップロードできます" }, { status: 415 });
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    const uploadDir = path.join(dataDir, "uploads");
    await mkdir(uploadDir, { recursive: true });
    const id = crypto.randomUUID();
    const extension = path
      .extname(file.name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, "");
    const originalPath = path.join(uploadDir, `${id}${extension}`);
    await writeFile(originalPath, Buffer.from(await file.arrayBuffer()));
    const [asset] = await db
      .insert(assets)
      .values({
        id,
        projectId,
        kind,
        originalName: file.name,
        originalPath,
        normalizedPath: kind === "psd" ? originalPath : null,
        status: kind === "psd" ? "ready" : "processing",
      })
      .returning();
    if (kind !== "psd") await assetQueue.add("normalize", { assetId: id }, { jobId: id, removeOnComplete: 100 });
    return NextResponse.json(asset, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
