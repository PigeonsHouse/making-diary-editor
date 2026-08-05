import { unlink } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { assets, characters, projects } from "@/server/db/schema";
import { apiError } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

async function getAssetUsage(id: string) {
  const [projectRows, characterRows] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, document: projects.document }).from(projects),
    db.select({ data: characters.data }).from(characters),
  ]);
  const usedByProjects = projectRows.filter(({ document }) => {
    const projectAudio = document.audio;
    const legacyProjectAudio = projectAudio as typeof projectAudio & { dateSe?: { assetId: string } | null };
    if (
      projectAudio &&
      [projectAudio.bgm, projectAudio.sceneIntroSe ?? legacyProjectAudio.dateSe, projectAudio.contentSe].some(
        (clip) => clip?.assetId === id,
      )
    ) {
      return true;
    }
    if (
      document.wishList &&
      ((document.wishList.sceneIntroSe?.mode === "custom" && document.wishList.sceneIntroSe.clip.assetId === id) ||
        (document.wishList.bgm?.mode === "custom" && document.wishList.bgm.clip.assetId === id))
    ) {
      return true;
    }
    return document.diaries.some((diary) => {
      const legacyDiary = diary as typeof diary & { dateSe?: typeof diary.sceneIntroSe };
      const sceneIntroSe = diary.sceneIntroSe ?? legacyDiary.dateSe;
      return (
        (sceneIntroSe?.mode === "custom" && sceneIntroSe.clip.assetId === id) ||
        (diary.bgm?.mode === "custom" && diary.bgm.clip.assetId === id) ||
        diary.blocks.some(
          (block) =>
            block.asset?.assetId === id || (block.entrySe?.mode === "custom" && block.entrySe.clip.assetId === id),
        )
      );
    });
  });
  const usedByCharacters = characterRows.filter(({ data }) => data.psdAssetId === id).map(({ data }) => data.name);
  return { usedByProjects, usedByCharacters };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as { projectId?: unknown; originalName?: unknown };
    const hasProjectId = Object.hasOwn(input, "projectId");
    const hasOriginalName = Object.hasOwn(input, "originalName");
    if (!hasProjectId && !hasOriginalName) {
      return NextResponse.json({ error: "変更内容がありません" }, { status: 400 });
    }
    if (hasProjectId && !(input.projectId === null || typeof input.projectId === "string")) {
      return NextResponse.json({ error: "移動先が不正です" }, { status: 400 });
    }
    if (hasOriginalName && typeof input.originalName !== "string") {
      return NextResponse.json({ error: "素材名が不正です" }, { status: 400 });
    }
    const originalName = typeof input.originalName === "string" ? input.originalName.trim() : undefined;
    if (hasOriginalName && !originalName) {
      return NextResponse.json({ error: "素材名を入力してください" }, { status: 400 });
    }
    if (originalName && originalName.length > 255) {
      return NextResponse.json({ error: "素材名は255文字以内で入力してください" }, { status: 400 });
    }

    const targetProjectId = hasProjectId ? (input.projectId as string | null) : undefined;
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    if (!asset) return NextResponse.json({ error: "素材が見つかりません" }, { status: 404 });

    if (targetProjectId && asset.projectId !== targetProjectId) {
      const [targetProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, targetProjectId));
      if (!targetProject) return NextResponse.json({ error: "移動先のプロジェクトが見つかりません" }, { status: 404 });

      const { usedByProjects, usedByCharacters } = await getAssetUsage(id);
      const otherProjects = usedByProjects.filter((project) => project.id !== targetProjectId);
      if (otherProjects.length || usedByCharacters.length) {
        const references = [
          ...otherProjects.map((project) => `プロジェクト「${project.name}」`),
          ...usedByCharacters.map((name) => `キャラクター「${name}」`),
        ];
        return NextResponse.json(
          { error: `他の場所で使用中のためプロジェクト専用にできません: ${references.join("、")}` },
          { status: 409 },
        );
      }
    }

    const [updated] = await db
      .update(assets)
      .set({
        ...(hasProjectId ? { projectId: targetProjectId } : {}),
        ...(originalName ? { originalName } : {}),
      })
      .where(eq(assets.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    if (!asset) return NextResponse.json({ error: "素材が見つかりません" }, { status: 404 });
    if (asset.status === "processing") {
      return NextResponse.json({ error: "変換中の素材は削除できません" }, { status: 409 });
    }

    const { usedByProjects, usedByCharacters } = await getAssetUsage(id);
    if (usedByProjects.length || usedByCharacters.length) {
      const references = [
        ...usedByProjects.map(({ name }) => `プロジェクト「${name}」`),
        ...usedByCharacters.map((name) => `キャラクター「${name}」`),
      ];
      return NextResponse.json({ error: `使用中のため削除できません: ${references.join("、")}` }, { status: 409 });
    }

    await db.delete(assets).where(eq(assets.id, id));
    const paths = [
      ...new Set([asset.originalPath, asset.normalizedPath].filter((value): value is string => Boolean(value))),
    ];
    await Promise.all(
      paths.map((filePath) =>
        unlink(filePath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        }),
      ),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
