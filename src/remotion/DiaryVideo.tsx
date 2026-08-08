"use client";

import "@fontsource-variable/noto-sans-jp";
import { useMemo } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  getBgmVolume,
  groupContinuousBgm,
  resolveAudioOverride,
  resolveSoundEffect,
  type AssetVolumeMap,
  type AudioScene,
} from "@/domain/audio";
import type { AssetTransparencyMap } from "@/domain/asset-transparency";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { layoutSubtitleText } from "@/domain/subtitle-layout";
import { calculateBlock, dialogueAudioStartFrame } from "@/domain/timeline";
import type { Character, ContentBlock, DiaryEntry, ProjectDocument } from "@/domain/types";
import { AssetBackground } from "./AssetBackground";
import { Avatars } from "./Avatars";
import { WishMarkdown } from "./WishMarkdown";

export { getVideoDuration } from "@/domain/video-duration";

type Props = {
  project: ProjectDocument;
  characters: Character[];
  defaultEndHold?: number;
  dialoguePsdPreviewUrls?: Record<string, string>;
  assetVolumes?: AssetVolumeMap;
  assetTransparency?: AssetTransparencyMap;
};

const secondsToFrames = (seconds: number, fps: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(fps) || fps <= 0) return 1;
  const frames = Math.ceil(seconds * fps);
  return Number.isSafeInteger(frames) && frames > 0 ? frames : 1;
};

export function DiaryVideo({
  project,
  characters,
  defaultEndHold,
  dialoguePsdPreviewUrls,
  assetVolumes = {},
  assetTransparency = {},
}: Props) {
  const { fps } = useVideoConfig();
  const { sequences, audioScenes } = useMemo(() => {
    let cursor = 0;
    const nextSequences: React.ReactNode[] = [];
    const nextAudioScenes: AudioScene[] = [];

    if (project.wishList) {
      const block: ContentBlock = {
        id: "wish",
        title: "",
        asset: null,
        dialogues: project.wishList.dialogues,
        durationSeconds: project.wishList.durationSeconds,
        endHoldSeconds: project.wishList.endHoldSeconds,
        entrySe: { mode: "none" },
      };
      const timing = calculateBlock(block, characters, defaultEndHold);
      const duration = secondsToFrames(timing.duration, fps);
      nextSequences.push(
        <Sequence key="wish" from={cursor} durationInFrames={duration}>
          <WishScene project={project} characters={characters} block={block} defaultEndHold={defaultEndHold} />
        </Sequence>,
      );
      nextAudioScenes.push({
        key: "wish",
        from: cursor,
        duration,
        bgm: resolveAudioOverride(project.audio.bgm, project.wishList.bgm, assetVolumes),
      });
      cursor += duration;
    }

    project.diaries.forEach((diary) => {
      const introSeconds = EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds;
      const blockSeconds = diary.blocks.reduce(
        (sum, block) => sum + calculateBlock(block, characters, defaultEndHold).duration,
        0,
      );
      const duration = secondsToFrames(introSeconds + blockSeconds, fps);
      nextSequences.push(
        <Sequence key={diary.id} from={cursor} durationInFrames={duration}>
          <DiaryScene
            project={project}
            diary={diary}
            characters={characters}
            defaultEndHold={defaultEndHold}
            dialoguePsdPreviewUrls={dialoguePsdPreviewUrls}
            assetVolumes={assetVolumes}
            assetTransparency={assetTransparency}
          />
        </Sequence>,
      );
      nextAudioScenes.push({
        key: diary.id,
        from: cursor,
        duration,
        bgm: resolveAudioOverride(project.audio.bgm, diary.bgm, assetVolumes),
      });
      cursor += duration;
    });
    return { sequences: nextSequences, audioScenes: nextAudioScenes };
  }, [assetTransparency, assetVolumes, characters, defaultEndHold, dialoguePsdPreviewUrls, fps, project]);

  const bgmSegments = useMemo(() => groupContinuousBgm(audioScenes), [audioScenes]);
  const sceneIntroSoundEffects = useMemo(
    () =>
      audioScenes.map((scene) => {
        const override =
          scene.key === "wish"
            ? project.wishList?.sceneIntroSe
            : project.diaries.find((diary) => diary.id === scene.key)?.sceneIntroSe;
        const clip = resolveAudioOverride(project.audio.sceneIntroSe, override, assetVolumes);
        return clip ? (
          <Sequence key={`scene-intro-${scene.key}`} from={scene.from} durationInFrames={scene.duration}>
            <Audio src={clip.url} volume={clip.volume} />
          </Sequence>
        ) : null;
      }),
    [assetVolumes, audioScenes, project],
  );

  return (
    <AbsoluteFill style={{ background: "#f4f6f8", fontFamily: '"Noto Sans JP Variable", sans-serif' }}>
      {bgmSegments.map((segment) => (
        <Sequence key={segment.key} from={segment.from} durationInFrames={segment.duration}>
          <Audio
            src={segment.clip.url}
            volume={(frame) => getBgmVolume(segment, frame)}
            loop
            loopVolumeCurveBehavior="extend"
          />
        </Sequence>
      ))}
      {sceneIntroSoundEffects}
      {sequences}
    </AbsoluteFill>
  );
}

function DiaryScene({
  project,
  diary,
  characters,
  defaultEndHold,
  dialoguePsdPreviewUrls,
  assetVolumes = {},
  assetTransparency = {},
}: Props & { diary: DiaryEntry }) {
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
  const activeDialogues =
    frame >= introFrames && activeEntry
      ? activeEntry.timing.dialogues
          .filter((item) => blockSeconds >= item.start && blockSeconds <= item.displayEnd)
          .map((item) => item.dialogue)
      : [];
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

function DialogueLayer({
  block,
  localFrame,
  blockStartFrame,
  characters,
  defaultEndHold,
  timing: providedTiming,
}: {
  block: ContentBlock;
  localFrame: number;
  blockStartFrame: number;
  characters: Character[];
  defaultEndHold?: number;
  timing?: ReturnType<typeof calculateBlock>;
}) {
  const { fps } = useVideoConfig();
  const seconds = localFrame / fps;
  const timing = useMemo(
    () => providedTiming ?? calculateBlock(block, characters, defaultEndHold),
    [block, characters, defaultEndHold, providedTiming],
  );
  const visible = timing.dialogues.filter((item) => seconds >= item.start && seconds <= item.displayEnd);
  return (
    <>
      {timing.dialogues.map((item) =>
        item.dialogue.audio.url ? (
          <Sequence
            key={`audio-${item.dialogue.id}`}
            from={dialogueAudioStartFrame(blockStartFrame, item.start, fps)}
            durationInFrames={secondsToFrames(item.audioEnd - item.start, fps)}
          >
            <Audio src={item.dialogue.audio.url} />
          </Sequence>
        ) : null,
      )}
      <div className="video-dialogue-stack">
        {visible.map((item, index) => {
          const character = characters.find((candidate) => candidate.id === item.dialogue.characterId);
          const subtitle = layoutSubtitleText(item.dialogue.text);
          return (
            <div
              key={item.dialogue.id}
              className="video-dialogue"
              style={{
                WebkitTextStroke: `10px ${character?.color ?? "#64748b"}`,
                fontSize: subtitle.fontSize,
                zIndex: index,
              }}
            >
              {subtitle.lines.map((line, lineIndex) => (
                <span className="video-dialogue-line" key={`${lineIndex}-${line}`}>
                  {line}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function WishScene({ project, characters, block, defaultEndHold }: Props & { block: ContentBlock }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="video-notebook">
      <WishMarkdown markdown={project.wishList?.markdown ?? ""} />
      <DialogueLayer
        block={block}
        localFrame={frame}
        blockStartFrame={0}
        characters={characters}
        defaultEndHold={defaultEndHold}
      />
    </AbsoluteFill>
  );
}

const formatDate = (date: string) => date.replaceAll("-", ".");
