import type {ProjectDocument} from "@/domain/types";

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

  return {document: cleaned, changed};
}
