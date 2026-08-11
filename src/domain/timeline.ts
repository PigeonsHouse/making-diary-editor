import { EDITOR_CONSTANTS } from "./defaults";
import type { Character, ContentBlock, Dialogue, ProjectDocument } from "./types";
import { getVideoPlaybackRateError } from "./video-asset";
import { validateSupportCredits } from "./support-credits";

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

type TimelineBlock = Omit<ContentBlock, "entrySe" | "bgmMuted"> & Partial<Pick<ContentBlock, "entrySe" | "bgmMuted">>;

export function dialogueAudioStartFrame(blockStartFrame: number, dialogueStartSeconds: number, fps: number) {
  return blockStartFrame + Math.round(dialogueStartSeconds * fps);
}

const characterMap = (characters: Character[]) => new Map(characters.map((character) => [character.id, character]));

const isPositiveFinite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

export function calculateBlock(
  block: TimelineBlock,
  characters: Character[],
  defaultEndHold: number = EDITOR_CONSTANTS.defaultBlockEndHoldSeconds,
): { dialogues: TimedDialogue[]; duration: number; issues: TimelineIssue[] } {
  if (block.dialogues.length === 0) {
    const duration = isPositiveFinite(block.durationSeconds) ? block.durationSeconds : 0;
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
    const audioDuration = isPositiveFinite(dialogue.audio.durationSeconds) ? dialogue.audio.durationSeconds : null;
    if (!audioDuration) {
      issues.push({ path: dialogue.id, message: "音声が生成されていません" });
    }

    const requestedPause =
      dialogue.pauseBeforeSeconds ?? (index === 0 ? 0 : (character?.defaultPauseBeforeSeconds ?? 0));
    const pause = finiteOr(requestedPause, 0);
    const previous = timed[index - 1];
    const start = previous ? previous.audioEnd + pause : pause;
    if (start < 0 || (previous && start < previous.start)) {
      issues.push({ path: dialogue.id, message: "前のセリフより前に発話を開始できません" });
    }
    if (previous && start >= previous.audioEnd) group += 1;

    const previewDuration = audioDuration ?? Math.max(0.8, Math.min(8, dialogue.text.length / 7));
    timed.push({
      dialogue,
      start,
      audioEnd: start + previewDuration,
      displayEnd: 0,
      overlapGroup: group,
    });
  });

  const requestedHold = block.endHoldSeconds ?? defaultEndHold;
  const hold = Number.isFinite(requestedHold) && requestedHold >= 0 ? requestedHold : 0;
  for (const item of timed) {
    const groupItems = timed.filter((candidate) => candidate.overlapGroup === item.overlapGroup);
    const last = groupItems.at(-1)!;
    const next = timed.find((candidate) => candidate.overlapGroup > item.overlapGroup);
    item.displayEnd = next?.start ?? last.audioEnd + hold;
  }

  return {
    dialogues: timed,
    duration: finiteOr(Math.max(...timed.map((item) => item.audioEnd)) + hold, 1),
    issues,
  };
}

export function validateProject(document: ProjectDocument, characters: Character[]): TimelineIssue[] {
  const issues: TimelineIssue[] = [...validateSupportCredits(document.supportCredits, characters)];
  const known = new Set(characters.map((character) => character.id));
  if (
    document.supportCredits.narratorCharacterId &&
    !document.characterIds.includes(document.supportCredits.narratorCharacterId)
  ) {
    issues.push({
      path: "supportCredits.narratorCharacterId",
      message: "広告・ギフト紹介の読み上げ担当をプロジェクトへ追加してください",
    });
  }
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
