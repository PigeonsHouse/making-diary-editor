"use client";

import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {calculateAvatarPositions, isAvatarFlipped} from "@/domain/avatar-layout";
import {EDITOR_CONSTANTS} from "@/domain/defaults";
import {calculateBlock, dialogueAudioStartFrame} from "@/domain/timeline";
import type {Character, ContentBlock, DiaryEntry, ProjectDocument} from "@/domain/types";
import {WishMarkdown} from "./WishMarkdown";

type Props = {
  project: ProjectDocument;
  characters: Character[];
  defaultEndHold?: number;
};

const secondsToFrames = (seconds: number, fps: number) => Math.max(1, Math.ceil(seconds * fps));

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
    } satisfies ContentBlock;
    seconds += calculateBlock(block, characters).duration;
  }
  for (const diary of project.diaries) {
    seconds += EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds;
    seconds += diary.blocks.reduce((sum, block) => sum + calculateBlock(block, characters).duration, 0);
  }
  return Math.max(fps, secondsToFrames(seconds, fps));
}

export function DiaryVideo({project, characters, defaultEndHold}: Props) {
  const {fps} = useVideoConfig();
  let cursor = 0;
  const sequences: React.ReactNode[] = [];

  if (project.wishList) {
    const block: ContentBlock = {
      id: "wish",
      title: "",
      asset: null,
      dialogues: project.wishList.dialogues,
      durationSeconds: project.wishList.durationSeconds,
      endHoldSeconds: project.wishList.endHoldSeconds,
    };
    const timing = calculateBlock(block, characters, defaultEndHold);
    const duration = secondsToFrames(timing.duration, fps);
    sequences.push(
      <Sequence key="wish" from={cursor} durationInFrames={duration}>
        <WishScene project={project} characters={characters} block={block} />
      </Sequence>,
    );
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
        <DiaryScene project={project} diary={diary} characters={characters} defaultEndHold={defaultEndHold} />
      </Sequence>,
    );
    cursor += duration;
  });

  return <AbsoluteFill style={{background: "#f4f6f8"}}>{sequences}</AbsoluteFill>;
}

function GridBackground() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage:
          "linear-gradient(#dce1e7 2px, transparent 2px), linear-gradient(90deg, #dce1e7 2px, transparent 2px)",
        backgroundSize: "48px 48px",
      }}
    />
  );
}

function AssetBackground({block}: {block?: ContentBlock}) {
  const asset = block?.asset;
  if (!asset) return <GridBackground />;
  const inset = EDITOR_CONSTANTS.mediaMarginPx;
  const crop = asset.trim;
  const style: React.CSSProperties = {
    position: "absolute",
    inset,
    width: `calc(100% - ${inset * 2}px)`,
    height: `calc(100% - ${inset * 2}px)`,
    objectFit: "contain",
    objectPosition: "center",
    clipPath: `inset(${crop.top}px ${crop.right}px ${crop.bottom}px ${crop.left}px)`,
  };
  if (asset.type === "image") return <Img src={asset.url} style={style} />;
  return (
    <>
      <OffthreadVideo
        src={asset.url}
        startFrom={Math.floor(asset.startSeconds * EDITOR_CONSTANTS.fps)}
        volume={asset.shortageMode === "fit-duration" ? 0 : asset.volume}
        style={style}
      />
    </>
  );
}

function DiaryScene({project, diary, characters, defaultEndHold}: Props & {diary: DiaryEntry}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const introFrames = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds, fps);
  let blockCursor = introFrames;
  let activeBlock = diary.blocks[0];
  let blockLocalFrame = frame;
  for (const block of diary.blocks) {
    const duration = secondsToFrames(calculateBlock(block, characters, defaultEndHold).duration, fps);
    if (frame >= blockCursor && frame < blockCursor + duration) {
      activeBlock = block;
      blockLocalFrame = frame - blockCursor;
      break;
    }
    blockCursor += duration;
  }
  const centerEnd = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds, fps);
  const fade =
    frame < introFrames
      ? interpolate(frame, [centerEnd, introFrames], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})
      : 1;

  return (
    <AbsoluteFill>
      <AssetBackground block={activeBlock} />
      <Avatars project={project} characters={characters} />
      {frame < centerEnd ? (
        <div className="video-date-center">{formatDate(diary.date)}</div>
      ) : (
        <>
          <div className="video-date-corner" style={{opacity: fade}}>
            {formatDate(diary.date)}
          </div>
          <div className="video-subtitle-corner" style={{opacity: fade}}>
            {diary.subtitle}
          </div>
          <div className="video-dialogue-panel" style={{opacity: fade}} />
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

function Avatars({project, characters}: Props) {
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
        const {side, level, top, edgeOffsetXPx} = positions[index];
        const flipped = isAvatarFlipped(index, project.characterAvatarOverrides[character.id]?.flipHorizontal);
        if (!character.avatar.previewUrl) return null;
        return (
          <Img
            key={character.id}
            src={character.avatar.previewUrl}
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
  const {fps} = useVideoConfig();
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
          return (
            <div
              key={item.dialogue.id}
              className="video-dialogue"
              style={{WebkitTextStroke: `5px ${character?.color ?? "#64748b"}`, zIndex: index}}
            >
              {item.dialogue.text}
            </div>
          );
        })}
      </div>
    </>
  );
}

function WishScene({project, characters, block}: Props & {block: ContentBlock}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="video-notebook">
      <WishMarkdown markdown={project.wishList?.markdown ?? ""} />
      <DialogueLayer block={block} localFrame={frame} blockStartFrame={0} characters={characters} />
    </AbsoluteFill>
  );
}

const formatDate = (date: string) => date.replaceAll("-", ".");
