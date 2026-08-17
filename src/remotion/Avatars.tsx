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
  speakingCharacterIds,
  dialoguePsdPreviewUrls,
  enlargeWithoutBackground,
}: {
  project: ProjectDocument;
  characters: Character[];
  startedDialogues: Dialogue[];
  speakingCharacterIds: string[];
  dialoguePsdPreviewUrls?: Record<string, string>;
  enlargeWithoutBackground: boolean;
}) {
  const hasActiveSpeaker = speakingCharacterIds.length > 0;
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
          scale:
            character.avatar.scale * (enlargeWithoutBackground ? EDITOR_CONSTANTS.avatarWithoutBackgroundScale : 1),
        })),
        project.characterAvatarOverrides,
        EDITOR_CONSTANTS.height * 0.77,
        EDITOR_CONSTANTS.height * EDITOR_CONSTANTS.avatarHeightRatio,
      ),
    };
  }, [characters, enlargeWithoutBackground, project.characterAvatarOverrides, project.characterIds]);

  return (
    <>
      {selected.map((character, index) => {
        const { side, level, top, edgeOffsetXPx, scale } = positions[index];
        const flipped = isAvatarFlipped(index, project.characterAvatarOverrides[character.id]?.flipHorizontal);
        const isInactive = hasActiveSpeaker && !speakingCharacterIds.includes(character.id);
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
              height: `${EDITOR_CONSTANTS.avatarHeightRatio * 100 * scale}%`,
              zIndex: 10 - level,
              transform: flipped ? "scaleX(-1)" : undefined,
              filter: isInactive ? "grayscale(45%) brightness(85%)" : undefined,
            }}
          />
        );
      })}
    </>
  );
}
