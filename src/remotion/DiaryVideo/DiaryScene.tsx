"use client";

import { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveSoundEffect } from "@/domain/audio";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { calculateBlock } from "@/domain/timeline";
import type { DiaryEntry } from "@/domain/types";
import { AssetBackground } from "../AssetBackground";
import { Avatars } from "../Avatars";
import { DialogueLayer } from "./DialogueLayer";
import { secondsToFrames } from "./timing";
import type { DiaryVideoProps } from "./types";

export function DiaryScene({
  project,
  diary,
  characters,
  defaultEndHold,
  dialoguePsdPreviewUrls,
  assetVolumes = {},
  assetTransparency = {},
}: DiaryVideoProps & { diary: DiaryEntry }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const introFrames = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds, fps);
  const blockTimeline = useMemo(() => {
    let cursor = introFrames;
    return diary.blocks.map((block) => {
      const timing = calculateBlock(block, characters, defaultEndHold);
      const durationInFrames = secondsToFrames(timing.duration, fps);
      const entry = { block, timing, from: cursor, durationInFrames };
      cursor += durationInFrames;
      return entry;
    });
  }, [characters, defaultEndHold, diary.blocks, fps, introFrames]);
  const activeEntry =
    blockTimeline.find((entry) => frame >= entry.from && frame < entry.from + entry.durationInFrames) ??
    blockTimeline[0];
  const activeBlock = activeEntry?.block;
  const blockCursor = activeEntry?.from ?? introFrames;
  const blockLocalFrame = frame - blockCursor;
  const activeBlockDurationSeconds = activeEntry?.timing.duration ?? 0;
  const centerEnd = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds, fps);
  const fade =
    frame < introFrames
      ? interpolate(frame, [centerEnd, introFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  const blockSeconds = blockLocalFrame / fps;
  const startedDialogues =
    frame >= introFrames && activeEntry
      ? activeEntry.timing.dialogues.filter((item) => blockSeconds >= item.start).map((item) => item.dialogue)
      : [];
  const contentSoundEffects = useMemo(
    () =>
      blockTimeline.map(({ block, from }) => {
        const clip = resolveSoundEffect(project.audio.contentSe, block.entrySe, assetVolumes);
        return clip ? (
          <Sequence key={`entry-se-${block.id}`} from={from}>
            <Audio src={clip.url} volume={clip.volume} />
          </Sequence>
        ) : null;
      }),
    [assetVolumes, blockTimeline, project.audio.contentSe],
  );

  return (
    <AbsoluteFill>
      {contentSoundEffects}
      <AssetBackground
        block={activeBlock}
        blockStartFrame={blockCursor}
        blockDurationSeconds={activeBlockDurationSeconds}
        blockDurationInFrames={secondsToFrames(activeBlockDurationSeconds, fps)}
        assetVolumes={assetVolumes}
        assetTransparency={assetTransparency}
      />
      <Avatars
        project={project}
        characters={characters}
        startedDialogues={startedDialogues}
        dialoguePsdPreviewUrls={dialoguePsdPreviewUrls}
      />
      {frame < centerEnd ? (
        <div className="video-date-center">{formatDate(diary.date)}</div>
      ) : (
        <>
          <div className="video-date-corner" style={{ opacity: fade }}>
            {formatDate(diary.date)}
          </div>
          <div className="video-subtitle-corner" style={{ opacity: fade }}>
            {diary.subtitle}
          </div>
          <div className="video-dialogue-panel" style={{ opacity: fade }} />
        </>
      )}
      {frame >= introFrames && activeBlock ? (
        <DialogueLayer
          block={activeBlock}
          localFrame={blockLocalFrame}
          blockStartFrame={blockCursor}
          characters={characters}
          defaultEndHold={defaultEndHold}
          timing={activeEntry.timing}
        />
      ) : null}
    </AbsoluteFill>
  );
}

const formatDate = (date: string) => date.replaceAll("-", ".");
