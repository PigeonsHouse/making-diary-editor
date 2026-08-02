import type { Character, Dialogue, ProjectDocument } from "./types";

export type DialoguePsdPreviewSpec = {
  key: string;
  assetId: string;
  filters: Character["psdFilters"];
  selections: Record<string, string>;
  dialogueIds: string[];
};

export function createDialoguePsdPreviewSpecs(
  project: ProjectDocument,
  characters: Character[],
): DialoguePsdPreviewSpec[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const dialogues = [
    ...(project.wishList?.dialogues ?? []),
    ...project.diaries.flatMap((diary) => diary.blocks.flatMap((block) => block.dialogues)),
  ];
  const specs = new Map<string, DialoguePsdPreviewSpec>();

  for (const dialogue of dialogues) {
    if (Object.keys(dialogue.psdOverrides).length === 0) continue;
    const character = charactersById.get(dialogue.characterId);
    if (!character?.psdAssetId) continue;
    const selections = { ...character.psdDefaults, ...dialogue.psdOverrides };
    const key = JSON.stringify({ assetId: character.psdAssetId, filters: character.psdFilters, selections });
    const existing = specs.get(key);
    if (existing) {
      existing.dialogueIds.push(dialogue.id);
    } else {
      specs.set(key, {
        key,
        assetId: character.psdAssetId,
        filters: character.psdFilters,
        selections,
        dialogueIds: [dialogue.id],
      });
    }
  }

  return [...specs.values()];
}

export function resolveDialogueAvatarUrl(
  defaultUrl: string | null,
  characterId: string,
  activeDialogues: Dialogue[],
  previewUrls: Record<string, string> = {},
) {
  for (let index = activeDialogues.length - 1; index >= 0; index--) {
    const dialogue = activeDialogues[index];
    if (dialogue.characterId === characterId && previewUrls[dialogue.id]) return previewUrls[dialogue.id];
  }
  return defaultUrl;
}
