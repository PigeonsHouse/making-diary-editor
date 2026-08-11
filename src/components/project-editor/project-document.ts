import type { ProjectDocument } from "@/domain/types";
import { getAssetDimensions, getAssetDurationSeconds } from "./asset-metadata";
import type { AssetRow } from "./types";

export function cleanLegacyVoiceOverrides(document: ProjectDocument) {
  const cleaned = structuredClone(document);
  let changed = false;
  const dialogues = [
    ...(cleaned.wishList?.dialogues ?? []),
    ...cleaned.diaries.flatMap((diary) => diary.blocks.flatMap((block) => block.dialogues)),
  ];

  for (const dialogue of dialogues) {
    const overrides = dialogue.voiceOverrides;
    const legacyInflated = ["styleName", "speed", "pitch", "intonation", "volume"].every((key) =>
      Object.hasOwn(overrides, key),
    );
    if (!legacyInflated) continue;
    if (overrides.styleName === "ノーマル") delete overrides.styleName;
    if (overrides.speed === 1) delete overrides.speed;
    if (overrides.pitch === 0) delete overrides.pitch;
    if (overrides.intonation === 1) delete overrides.intonation;
    if (overrides.volume === 1) delete overrides.volume;
    changed = true;
  }

  return { document: cleaned, changed };
}

export function fillMissingAssetMetadata(document: ProjectDocument, assets: AssetRow[]) {
  const filled = structuredClone(document);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  let changed = false;

  for (const block of filled.diaries.flatMap((diary) => diary.blocks)) {
    if (!block.asset) continue;
    const asset = assetsById.get(block.asset.assetId);
    if (block.asset.type === "video" && block.asset.sourceDurationSeconds === null) {
      const duration = getAssetDurationSeconds(asset);
      if (duration !== null) {
        block.asset.sourceDurationSeconds = duration;
        changed = true;
      }
    }
    if (block.asset.sourceWidth === null || block.asset.sourceHeight === null) {
      const dimensions = getAssetDimensions(asset);
      if (dimensions !== null) {
        block.asset.sourceWidth = dimensions.width;
        block.asset.sourceHeight = dimensions.height;
        changed = true;
      }
    }
  }

  return { document: filled, changed };
}
