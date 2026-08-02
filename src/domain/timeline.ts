import { EDITOR_CONSTANTS } from "./defaults";
import type { Character, ContentBlock, Dialogue, ProjectDocument } from "./types";
import { getVideoPlaybackRateError } from "./video-asset";

export type TimedDialogue = {
  dialogue: Dialogue;
  start: number;
  audioEnd: number;
  displayEnd: number;
  overlapGroup: number;
};

export type TimelineIssue = {
  path: string;
  message: string;
};

export function dialogueAudioStartFrame(blockStartFrame: number, dialogueStartSeconds: number, fps: number) {
  return blockStartFrame + Math.round(dialogueStartSeconds * fps);
}

const characterMap = (characters: Character[]) => new Map(characters.map((character) => [character.id, character]));

export function calculateBlock(
  block: ContentBlock,
  characters: Character[],
  defaultEndHold: number = EDITOR_CONSTANTS.defaultBlockEndHoldSeconds,
): { dialogues: TimedDialogue[]; duration: number; issues: TimelineIssue[] } {
  if (block.dialogues.length === 0) {
    const duration = block.durationSeconds ?? 0;
    return {
      dialogues: [],
      duration,
      issues: duration > 0 ? [] : [{ path: block.id, message: "無言ブロックには表示秒数が必要です" }],
    };
  }

  const byId = characterMap(characters);
  const timed: TimedDialogue[] = [];
  const issues: TimelineIssue[] = [];
  let group = 0;

  block.dialogues.forEach((dialogue, index) => {
    const character = byId.get(dialogue.characterId);
    if (!character) {
      issues.push({ path: dialogue.id, message: "参照キャラクターが存在しません" });
    }
    if (!dialogue.audio.durationSeconds) {
      issues.push({ path: dialogue.id, message: "音声が生成されていません" });
    }

    const pause = dialogue.pauseBeforeSeconds ?? (index === 0 ? 0 : (character?.defaultPauseBeforeSeconds ?? 0));
    const previous = timed[index - 1];
    const start = previous ? previous.audioEnd + pause : pause;
    if (start < 0 || (previous && start < previous.start)) {
      issues.push({ path: dialogue.id, message: "前のセリフより前に発話を開始できません" });
    }
    if (previous && start >= previous.audioEnd) group += 1;

    const previewDuration = dialogue.audio.durationSeconds ?? Math.max(0.8, Math.min(8, dialogue.text.length / 7));
    timed.push({
      dialogue,
      start,
      audioEnd: start + previewDuration,
      displayEnd: 0,
      overlapGroup: group,
    });
  });

  const hold = block.endHoldSeconds ?? defaultEndHold;
  for (const item of timed) {
    const groupItems = timed.filter((candidate) => candidate.overlapGroup === item.overlapGroup);
    const last = groupItems.at(-1)!;
    const next = timed.find((candidate) => candidate.overlapGroup > item.overlapGroup);
    item.displayEnd = next?.start ?? last.audioEnd + hold;
  }

  return {
    dialogues: timed,
    duration: Math.max(...timed.map((item) => item.audioEnd)) + hold,
    issues,
  };
}

export function validateProject(document: ProjectDocument, characters: Character[]): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const known = new Set(characters.map((character) => character.id));
  for (const id of document.characterIds) {
    if (!known.has(id)) issues.push({ path: id, message: "登場キャラクターが削除されています" });
  }
  const dates = new Set<string>();
  for (const diary of document.diaries) {
    if (dates.has(diary.date)) issues.push({ path: diary.id, message: "日誌の日付が重複しています" });
    dates.add(diary.date);
    for (const block of diary.blocks) {
      const timing = calculateBlock(block, characters);
      issues.push(...timing.issues);
      if (block.asset?.type !== "video") continue;
      const playbackRateError = getVideoPlaybackRateError(block.asset, timing.duration, EDITOR_CONSTANTS.fps);
      if (playbackRateError) issues.push({ path: block.id, message: playbackRateError });
    }
  }
  return issues;
}
