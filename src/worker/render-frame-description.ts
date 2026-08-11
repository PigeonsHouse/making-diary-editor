import type { Character, ContentBlock, ProjectDocument } from "@/domain/types";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { calculateBlock } from "@/domain/timeline";

const secondsToFrames = (seconds: number, fps: number) => Math.max(1, Math.ceil(seconds * fps));

const describeAsset = (block: ContentBlock) =>
  block.asset ? `${block.asset.type}:${block.asset.assetId}` : "no-asset";

export function createFrameDescription(project: ProjectDocument, characters: Character[], fps = EDITOR_CONSTANTS.fps) {
  const segments: { from: number; to: number; description: string }[] = [];
  let cursor = 0;

  if (project.wishList) {
    const block = {
      id: "wish",
      title: "",
      asset: null,
      dialogues: project.wishList.dialogues,
      durationSeconds: project.wishList.durationSeconds,
      endHoldSeconds: project.wishList.endHoldSeconds,
      bgmMuted: false,
      entrySe: { mode: "none" },
    } satisfies ContentBlock;
    const frames = secondsToFrames(calculateBlock(block, characters).duration, fps);
    segments.push({ from: cursor, to: cursor + frames, description: "wish-list" });
    cursor += frames;
  }

  for (const diary of project.diaries) {
    const introFrames = secondsToFrames(EDITOR_CONSTANTS.dateCenterSeconds + EDITOR_CONSTANTS.diaryUiFadeSeconds, fps);
    segments.push({ from: cursor, to: cursor + introFrames, description: `diary=${diary.date} intro` });
    cursor += introFrames;
    for (const block of diary.blocks) {
      const frames = secondsToFrames(calculateBlock(block, characters).duration, fps);
      segments.push({
        from: cursor,
        to: cursor + frames,
        description: `diary=${diary.date} block=${block.id} asset=${describeAsset(block)}`,
      });
      cursor += frames;
    }
  }

  return (frame: number) =>
    segments.find((segment) => frame >= segment.from && frame < segment.to)?.description ?? "outside-timeline";
}
