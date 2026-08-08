"use client";

import { Player } from "@remotion/player";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import type { Character, ProjectDocument } from "@/domain/types";
import { DiaryVideo, getVideoDuration } from "@/remotion/DiaryVideo";
import { useDialoguePsdPreviewUrls } from "./project-editor/useDialoguePsdPreviewUrls";
import type { AssetRow } from "./project-editor/types";

export function VideoPreview({
  project,
  characters,
  assets,
}: {
  project: ProjectDocument;
  characters: Character[];
  assets: AssetRow[];
}) {
  const dialoguePsdPreviewUrls = useDialoguePsdPreviewUrls(project, characters);
  const calculatedDurationInFrames = getVideoDuration(project, characters);
  const durationInFrames =
    Number.isSafeInteger(calculatedDurationInFrames) && calculatedDurationInFrames > 0
      ? calculatedDurationInFrames
      : EDITOR_CONSTANTS.fps;
  const assetVolumes = Object.fromEntries(assets.map((asset) => [asset.id, asset.defaultVolume]));

  return (
    <div className="preview-shell">
      <Player
        component={DiaryVideo}
        inputProps={{ project, characters, dialoguePsdPreviewUrls, assetVolumes }}
        durationInFrames={durationInFrames}
        fps={EDITOR_CONSTANTS.fps}
        compositionWidth={EDITOR_CONSTANTS.width}
        compositionHeight={EDITOR_CONSTANTS.height}
        controls
        numberOfSharedAudioTags={60}
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
