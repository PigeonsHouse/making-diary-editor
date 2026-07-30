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
import {EDITOR_CONSTANTS} from "@/domain/defaults";
import {calculateBlock} from "@/domain/timeline";
import type {Character, ContentBlock, DiaryEntry, ProjectDocument} from "@/domain/types";

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
      endHoldSeconds: null,
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
      endHoldSeconds: null,
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
        <DiaryScene
          project={project}
          diary={diary}
          characters={characters}
          defaultEndHold={defaultEndHold}
        />
      </Sequence>,
    );
    cursor += duration;
  });

  return <AbsoluteFill style={{background: "#f4f6f8"}}>{sequences}</AbsoluteFill>;
}

function GridBackground() {
  return <AbsoluteFill style={{
    backgroundColor: "#f8fafc",
    backgroundImage: "linear-gradient(#dce1e7 2px, transparent 2px), linear-gradient(90deg, #dce1e7 2px, transparent 2px)",
    backgroundSize: "48px 48px",
  }} />;
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
  const introFrames = secondsToFrames(
    EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds,
    fps,
  );
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
  const fade = frame < introFrames
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
          <div className="video-date-corner" style={{opacity: fade}}>{formatDate(diary.date)}</div>
          <div className="video-subtitle-corner" style={{opacity: fade}}>{diary.subtitle}</div>
          <div className="video-dialogue-panel" style={{opacity: fade}} />
        </>
      )}
      {frame >= introFrames && activeBlock ? (
        <DialogueLayer
          block={activeBlock}
          localFrame={blockLocalFrame}
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
  return (
    <>
      {selected.map((character, index) => {
        const side = index % 2 === 0 ? "right" : "left";
        const level = Math.floor(index / 2);
        const bottom = 540 - project.avatarLayout.basePeekOffsetPx +
          level * project.avatarLayout.stackStepPx + character.avatar.offsetY;
        if (!character.avatar.previewUrl) return null;
        return (
          <Img
            key={character.id}
            src={character.avatar.previewUrl}
            style={{
              position: "absolute",
              bottom,
              [side]: character.avatar.offsetX,
              height: `${70 * character.avatar.scale}%`,
              zIndex: 10 - level,
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
  characters,
  defaultEndHold,
}: {
  block: ContentBlock;
  localFrame: number;
  characters: Character[];
  defaultEndHold?: number;
}) {
  const {fps} = useVideoConfig();
  const seconds = localFrame / fps;
  const timing = calculateBlock(block, characters, defaultEndHold);
  const visible = timing.dialogues.filter((item) => seconds >= item.start && seconds <= item.displayEnd);
  return (
    <>
      {timing.dialogues.map((item) => item.dialogue.audio.url && seconds >= item.start ? (
        <Sequence
          key={`audio-${item.dialogue.id}`}
          from={Math.round(item.start * fps)}
          durationInFrames={secondsToFrames(item.audioEnd - item.start, fps)}
        >
          <Audio src={item.dialogue.audio.url} />
        </Sequence>
      ) : null)}
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
      <div className="video-wish-markdown">
        {project.wishList?.markdown.split("\n").map((line, index) => (
          <div key={index} style={{paddingLeft: `${Math.max(0, line.search(/\S/)) * 16}px`}}>
            {line.replace(/^\s*[-*]\s*/, "・")}
          </div>
        ))}
      </div>
      <DialogueLayer block={block} localFrame={frame} characters={characters} />
    </AbsoluteFill>
  );
}

const formatDate = (date: string) => date.replaceAll("-", ".");
