"use client";

import { useMemo } from "react";
import { Img } from "remotion";
import { calculateAvatarPositions, isAvatarFlipped } from "@/domain/avatar-layout";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { resolveDialogueAvatarUrl } from "@/domain/psd-previews";
import type { Character, Dialogue, ProjectDocument } from "@/domain/types";

export function Avatars({
  project,
  characters,
  startedDialogues,
  dialoguePsdPreviewUrls,
}: {
  project: ProjectDocument;
  characters: Character[];
  startedDialogues: Dialogue[];
  dialoguePsdPreviewUrls?: Record<string, string>;
}) {
  const { selected, positions } = useMemo(() => {
    const charactersById = new Map(characters.map((character) => [character.id, character]));
    const nextSelected = project.characterIds.map((id) => charactersById.get(id)).filter(Boolean) as Character[];
    return {
      selected: nextSelected,
      positions: calculateAvatarPositions(
        nextSelected.map((character) => ({
          id: character.id,
          edgeOffsetXPx: character.avatar.edgeOffsetXPx,
          peekYPx: character.avatar.peekYPx,
        })),
        project.characterAvatarOverrides,
        EDITOR_CONSTANTS.height * 0.77,
      ),
    };
  }, [characters, project.characterAvatarOverrides, project.characterIds]);

  return (
    <>
      {selected.map((character, index) => {
        const { side, level, top, edgeOffsetXPx } = positions[index];
        const flipped = isAvatarFlipped(index, project.characterAvatarOverrides[character.id]?.flipHorizontal);
        const avatarUrl = resolveDialogueAvatarUrl(
          character.avatar.previewUrl,
          character.id,
          startedDialogues,
          dialoguePsdPreviewUrls,
        );
        if (!avatarUrl) return null;
        return (
          <Img
            key={character.id}
            src={avatarUrl}
            style={{
              position: "absolute",
              top,
              [side]: edgeOffsetXPx,
              height: `${70 * character.avatar.scale}%`,
              zIndex: 10 - level,
              transform: flipped ? "scaleX(-1)" : undefined,
            }}
          />
        );
      })}
    </>
  );
}
