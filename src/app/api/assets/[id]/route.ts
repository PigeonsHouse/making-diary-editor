import { unlink } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { assets, characters, projects } from "@/server/db/schema";
import { apiError } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    if (!asset) return NextResponse.json({ error: "素材が見つかりません" }, { status: 404 });
    if (asset.status === "processing") {
      return NextResponse.json({ error: "変換中の素材は削除できません" }, { status: 409 });
    }

    const [projectRows, characterRows] = await Promise.all([
      db.select({ name: projects.name, document: projects.document }).from(projects),
      db.select({ data: characters.data }).from(characters),
    ]);
    const usedByProjects = projectRows
      .filter(({ document }) => {
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
      })
      .map(({ name }) => name);
    const usedByCharacters = characterRows.filter(({ data }) => data.psdAssetId === id).map(({ data }) => data.name);
    if (usedByProjects.length || usedByCharacters.length) {
      const references = [
        ...usedByProjects.map((name) => `プロジェクト「${name}」`),
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
