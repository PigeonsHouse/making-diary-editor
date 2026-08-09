import type { Character, ProjectDocument } from "./types";
import { hasSupport, isSupportCacheCurrent } from "./support-credits";

type AssetLike = { id: string; originalName: string };

// プロジェクト全体で常に表示したいIDは、この配列へベタ書きで追加する。
export const PROJECT_FIXED_CREDIT_IDS: readonly string[] = ["nc256993"];

const creditIdPattern = /(?:sm|im|nc)\d+/gi;

export function extractCreditIds(value: string): string[] {
  return (value.match(creditIdPattern) ?? []).map((id) => id.toLowerCase());
}

export function getUsedAssetIds(project: ProjectDocument, characters: Character[]): Set<string> {
  const used = new Set<string>();
  const addClip = (clip: { assetId: string } | null | undefined) => {
    if (clip) used.add(clip.assetId);
  };
  const addOverride = (override: { mode: string; clip?: { assetId: string } }) => {
    if (override.mode === "custom" && override.clip) addClip(override.clip);
  };
  const addResolvedOverride = (
    override: { mode: string; clip?: { assetId: string } },
    inherited: { assetId: string } | null,
  ) => {
    if (override.mode === "inherit") addClip(inherited);
    else addOverride(override);
  };

  const hasVisualScene = project.wishList !== null || project.diaries.some((diary) => diary.blocks.length > 0);
  if (hasVisualScene) {
    for (const characterId of project.characterIds) {
      const psdAssetId = characters.find((character) => character.id === characterId)?.psdAssetId;
      if (psdAssetId) used.add(psdAssetId);
    }
  }

  if (project.wishList) {
    addResolvedOverride(project.wishList.bgm, project.audio.bgm);
    addResolvedOverride(project.wishList.sceneIntroSe, project.audio.sceneIntroSe);
  }
  if (isSupportCacheCurrent(project.supportCredits) && hasSupport(project.supportCredits.cache)) {
    addResolvedOverride(project.supportCredits.bgm, project.audio.bgm);
    addResolvedOverride(project.supportCredits.sceneIntroSe, project.audio.sceneIntroSe);
  }
  for (const diary of project.diaries) {
    addResolvedOverride(diary.bgm, project.audio.bgm);
    addResolvedOverride(diary.sceneIntroSe, project.audio.sceneIntroSe);
    for (const block of diary.blocks) {
      addClip(block.asset);
      addResolvedOverride(block.entrySe, project.audio.contentSe);
    }
  }
  return used;
}

export function getProjectCreditIds(project: ProjectDocument, characters: Character[], assets: AssetLike[]): string[] {
  const usedAssetIds = getUsedAssetIds(project, characters);
  const usedAssetCreditIds = assets
    .filter((asset) => usedAssetIds.has(asset.id))
    .flatMap((asset) => extractCreditIds(asset.originalName));
  const characterCreditIds = project.characterIds.flatMap(
    (id) => characters.find((character) => character.id === id)?.creditIds ?? [],
  );

  return [
    ...new Set(
      [...PROJECT_FIXED_CREDIT_IDS, ...characterCreditIds, ...usedAssetCreditIds]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}
