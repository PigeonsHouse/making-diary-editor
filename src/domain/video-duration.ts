import { EDITOR_CONSTANTS } from "./defaults";
import { calculateBlock } from "./timeline";
import { getSupportCreditsGroups } from "./support-credits";
import type { Character, ContentBlock, ProjectDocument } from "./types";

const secondsToFrames = (seconds: number, fps: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(fps) || fps <= 0) return 1;
  const frames = Math.ceil(seconds * fps);
  return Number.isSafeInteger(frames) && frames > 0 ? frames : 1;
};

export function getVideoDuration(project: ProjectDocument, characters: Character[], fps = EDITOR_CONSTANTS.fps) {
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
  seconds += getSupportCreditsGroups(project.supportCredits, characters).reduce(
    (sum, group) => sum + Math.ceil(group.timing.duration * fps) / fps,
    0,
  );
  const minimumFrames = Number.isSafeInteger(fps) && fps > 0 ? fps : EDITOR_CONSTANTS.fps;
  return Math.max(minimumFrames, secondsToFrames(seconds, fps));
}
