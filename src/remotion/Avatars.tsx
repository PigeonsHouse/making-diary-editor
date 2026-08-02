"use client";

import { Img } from "remotion";
import { calculateAvatarPositions, isAvatarFlipped } from "@/domain/avatar-layout";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { resolveDialogueAvatarUrl } from "@/domain/psd-previews";
import type { Character, Dialogue, ProjectDocument } from "@/domain/types";

export function Avatars({
  project,
  characters,
  activeDialogues,
  dialoguePsdPreviewUrls,
}: {
  project: ProjectDocument;
  characters: Character[];
  activeDialogues: Dialogue[];
  dialoguePsdPreviewUrls?: Record<string, string>;
}) {
  const selected = project.characterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter(Boolean) as Character[];
  const positions = calculateAvatarPositions(
    selected.map((character) => ({
      id: character.id,
      edgeOffsetXPx: character.avatar.edgeOffsetXPx,
      peekYPx: character.avatar.peekYPx,
    })),
    project.characterAvatarOverrides,
    EDITOR_CONSTANTS.height * 0.77,
  );

  return (
    <>
      {selected.map((character, index) => {
        const { side, level, top, edgeOffsetXPx } = positions[index];
        const flipped = isAvatarFlipped(index, project.characterAvatarOverrides[character.id]?.flipHorizontal);
        const avatarUrl = resolveDialogueAvatarUrl(
          character.avatar.previewUrl,
          character.id,
          activeDialogues,
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
