"use client";

import "@fontsource-variable/noto-sans-jp";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  getBgmVolume,
  groupContinuousBgm,
  resolveAudioOverride,
  resolveSoundEffect,
  type AudioScene,
} from "@/domain/audio";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { layoutSubtitleText } from "@/domain/subtitle-layout";
import { calculateBlock, dialogueAudioStartFrame } from "@/domain/timeline";
import type { Character, ContentBlock, DiaryEntry, ProjectDocument } from "@/domain/types";
import { AssetBackground } from "./AssetBackground";
import { Avatars } from "./Avatars";
import { WishMarkdown } from "./WishMarkdown";

type Props = {
  project: ProjectDocument;
  characters: Character[];
  defaultEndHold?: number;
  dialoguePsdPreviewUrls?: Record<string, string>;
};

const secondsToFrames = (seconds: number, fps: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(fps) || fps <= 0) return 1;
  const frames = Math.ceil(seconds * fps);
  return Number.isSafeInteger(frames) && frames > 0 ? frames : 1;
};

export function getVideoDuration(project: ProjectDocument, characters: Character[], fps = 30) {
  let seconds = 0;
  if (project.wishList) {
    const block = {
      id: "wish",
      title: "",
      asset: null,
      dialogues: project.wishList.dialogues,
      durationSeconds: project.wishList.durationSeconds,
      endHoldSeconds: project.wishList.endHoldSeconds,
      entrySe: { mode: "none" },
    } satisfies ContentBlock;
    seconds += calculateBlock(block, characters).duration;
  }
  for (const diary of project.diaries) {
    seconds += EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds;
    seconds += diary.blocks.reduce((sum, block) => sum + calculateBlock(block, characters).duration, 0);
  }
  const minimumFrames = Number.isSafeInteger(fps) && fps > 0 ? fps : EDITOR_CONSTANTS.fps;
  return Math.max(minimumFrames, secondsToFrames(seconds, fps));
}

export function DiaryVideo({ project, characters, defaultEndHold, dialoguePsdPreviewUrls }: Props) {
  const { fps } = useVideoConfig();
  let cursor = 0;
  const sequences: React.ReactNode[] = [];
  const audioScenes: AudioScene[] = [];

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
    sequences.push(
      <Sequence key="wish" from={cursor} durationInFrames={duration}>
        <WishScene project={project} characters={characters} block={block} defaultEndHold={defaultEndHold} />
      </Sequence>,
    );
    audioScenes.push({
      key: "wish",
      from: cursor,
      duration,
      bgm: resolveAudioOverride(project.audio.bgm, project.wishList.bgm),
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
    sequences.push(
      <Sequence key={diary.id} from={cursor} durationInFrames={duration}>
        <DiaryScene
          project={project}
          diary={diary}
          characters={characters}
          defaultEndHold={defaultEndHold}
          dialoguePsdPreviewUrls={dialoguePsdPreviewUrls}
        />
      </Sequence>,
    );
    audioScenes.push({
      key: diary.id,
      from: cursor,
      duration,
      bgm: resolveAudioOverride(project.audio.bgm, diary.bgm),
    });
    cursor += duration;
  });

  const bgmSegments = groupContinuousBgm(audioScenes);
  const sceneIntroSoundEffects = audioScenes.map((scene) => {
    const override =
      scene.key === "wish"
        ? project.wishList?.sceneIntroSe
        : project.diaries.find((diary) => diary.id === scene.key)?.sceneIntroSe;
    const clip = resolveAudioOverride(project.audio.sceneIntroSe, override);
    return clip ? (
      <Sequence key={`scene-intro-${scene.key}`} from={scene.from} durationInFrames={scene.duration}>
        <Audio src={clip.url} volume={clip.volume} />
      </Sequence>
    ) : null;
  });

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
}: Props & { diary: DiaryEntry }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const introFrames = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds, fps);
  let blockCursor = introFrames;
  let activeBlock = diary.blocks[0];
  let blockLocalFrame = frame;
  let activeBlockDurationSeconds = activeBlock ? calculateBlock(activeBlock, characters, defaultEndHold).duration : 0;
  for (const block of diary.blocks) {
    const durationSeconds = calculateBlock(block, characters, defaultEndHold).duration;
    const duration = secondsToFrames(durationSeconds, fps);
    if (frame >= blockCursor && frame < blockCursor + duration) {
      activeBlock = block;
      blockLocalFrame = frame - blockCursor;
      activeBlockDurationSeconds = durationSeconds;
      break;
    }
    blockCursor += duration;
  }
  const centerEnd = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds, fps);
  const fade =
    frame < introFrames
      ? interpolate(frame, [centerEnd, introFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  const activeDialogues =
    frame >= introFrames && activeBlock
      ? getVisibleDialogues(activeBlock, blockLocalFrame, fps, characters, defaultEndHold)
      : [];
  const startedDialogues =
    frame >= introFrames && activeBlock
      ? getStartedDialogues(activeBlock, blockLocalFrame, fps, characters, defaultEndHold)
      : [];
  let contentSeCursor = introFrames;
  const contentSoundEffects = diary.blocks.map((block) => {
    const startFrame = contentSeCursor;
    contentSeCursor += secondsToFrames(calculateBlock(block, characters, defaultEndHold).duration, fps);
    const clip = resolveSoundEffect(project.audio.contentSe, block.entrySe);
    return clip ? (
      <Sequence key={`entry-se-${block.id}`} from={startFrame}>
        <Audio src={clip.url} volume={clip.volume} />
      </Sequence>
    ) : null;
  });

  return (
    <AbsoluteFill>
      {contentSoundEffects}
      <AssetBackground
        block={activeBlock}
        blockStartFrame={blockCursor}
        blockDurationSeconds={activeBlockDurationSeconds}
        blockDurationInFrames={secondsToFrames(activeBlockDurationSeconds, fps)}
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
}: {
  block: ContentBlock;
  localFrame: number;
  blockStartFrame: number;
  characters: Character[];
  defaultEndHold?: number;
}) {
  const { fps } = useVideoConfig();
  const seconds = localFrame / fps;
  const timing = calculateBlock(block, characters, defaultEndHold);
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

function getVisibleDialogues(
  block: ContentBlock,
  localFrame: number,
  fps: number,
  characters: Character[],
  defaultEndHold?: number,
) {
  const seconds = localFrame / fps;
  return calculateBlock(block, characters, defaultEndHold)
    .dialogues.filter((item) => seconds >= item.start && seconds <= item.displayEnd)
    .map((item) => item.dialogue);
}

function getStartedDialogues(
  block: ContentBlock,
  localFrame: number,
  fps: number,
  characters: Character[],
  defaultEndHold?: number,
) {
  const seconds = localFrame / fps;
  return calculateBlock(block, characters, defaultEndHold)
    .dialogues.filter((item) => seconds >= item.start)
    .map((item) => item.dialogue);
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
