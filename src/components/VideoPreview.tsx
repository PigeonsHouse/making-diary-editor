"use client";

import { Player } from "@remotion/player";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import type { Character, ProjectDocument } from "@/domain/types";
import { DiaryVideo, getVideoDuration } from "@/remotion/DiaryVideo";

export function VideoPreview({ project, characters }: { project: ProjectDocument; characters: Character[] }) {
  return (
    <div className="preview-shell">
      <Player
        component={DiaryVideo}
        inputProps={{ project, characters }}
        durationInFrames={getVideoDuration(project, characters)}
        fps={EDITOR_CONSTANTS.fps}
        compositionWidth={EDITOR_CONSTANTS.width}
        compositionHeight={EDITOR_CONSTANTS.height}
        controls
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
