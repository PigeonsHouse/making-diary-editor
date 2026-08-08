import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateProject } from "@/domain/timeline";
import { projectDocumentSchema } from "@/domain/types";
import { getUsedAssetIds } from "@/domain/project-credit-ids";
import { createAssetTransparencyMap } from "@/domain/asset-transparency";
import { db } from "@/server/db";
import { assets, characters, projects, renderJobs } from "@/server/db/schema";
import { apiError } from "@/server/http";
import { renderQueue } from "@/server/queue";
import { createRenderSignature, findCachedRender } from "@/server/render-cache";

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    const document = projectDocumentSchema.parse(project.document);
    const characterRows = await db.select().from(characters);
    const allCharacterData = characterRows.map((row) => row.data);
    const issues = validateProject(document, allCharacterData);
    if (issues.length) return NextResponse.json({ error: "レンダリング前の修正が必要です", issues }, { status: 422 });
    const selectedCharacterIds = new Set(document.characterIds);
    const characterData = allCharacterData.filter((character) => selectedCharacterIds.has(character.id));
    const usedAssetIds = getUsedAssetIds(document, characterData);
    const assetRows = await db
      .select({ id: assets.id, defaultVolume: assets.defaultVolume, metadata: assets.metadata })
      .from(assets);
    const usedAssetRows = assetRows.filter((asset) => usedAssetIds.has(asset.id));
    const assetVolumes = Object.fromEntries(usedAssetRows.map((asset) => [asset.id, asset.defaultVolume]));
    const assetTransparency = createAssetTransparencyMap(usedAssetRows);
    const renderSignature = createRenderSignature(document, characterData, assetVolumes, assetTransparency);
    const cached = await findCachedRender(renderSignature);
    const creation = await db.transaction(async (tx) => {
      // UIだけに依存せず、複数タブや同時リクエストでもプロジェクトごとに直列化する。
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${projectId}))`);
      const [activeJob] = await tx
        .select()
        .from(renderJobs)
        .where(
          and(
            eq(renderJobs.projectId, projectId),
            inArray(renderJobs.status, ["queued", "preparing", "rendering", "cancelling"]),
          ),
        )
        .limit(1);
      if (activeJob) return { kind: "active" as const, job: activeJob };

      const [job] = await tx
        .insert(renderJobs)
        .values(
          cached
            ? {
                projectId,
                snapshot: document,
                status: "completed",
                progress: 100,
                outputPath: cached.outputPath,
              }
            : { projectId, snapshot: document },
        )
        .returning();
      return { kind: cached ? ("cached" as const) : ("queued" as const), job };
    });

    if (creation.kind === "active") {
      return NextResponse.json(
        { error: "このプロジェクトは既にレンダリング中です", job: creation.job },
        { status: 409 },
      );
    }
    if (creation.kind === "cached") {
      console.log(`[render-cache:${projectId}] hit ${renderSignature.slice(0, 12)}`);
      return NextResponse.json(creation.job, { status: 201 });
    }

    console.log(`[render-cache:${projectId}] miss ${renderSignature.slice(0, 12)}`);
    try {
      await renderQueue.add(
        "render",
        { renderJobId: creation.job.id, characterData, assetVolumes, assetTransparency, renderSignature },
        {
          jobId: creation.job.id,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      await db
        .update(renderJobs)
        .set({
          status: "failed",
          etaMs: null,
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(and(eq(renderJobs.id, creation.job.id), eq(renderJobs.status, "queued")));
      throw error;
    }
    return NextResponse.json(creation.job, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const columns = {
    id: renderJobs.id,
    projectId: renderJobs.projectId,
    status: renderJobs.status,
    progress: renderJobs.progress,
    etaMs: renderJobs.etaMs,
    error: renderJobs.error,
    createdAt: renderJobs.createdAt,
    updatedAt: renderJobs.updatedAt,
  };
  const rows = projectId
    ? await db
        .select(columns)
        .from(renderJobs)
        .where(eq(renderJobs.projectId, projectId))
        .orderBy(desc(renderJobs.createdAt))
    : await db.select(columns).from(renderJobs).orderBy(desc(renderJobs.createdAt));
  return NextResponse.json(rows);
}
