import { createDialogue } from "./defaults";
import { calculateBlock } from "./timeline";
import type { TimelineIssue } from "./timeline";
import type { Character, Dialogue, SupportCredits, SupportCreditsCache, SupportNarration } from "./types";

export const SUPPORT_INTRO_TITLE = "広告・ギフト紹介のコーナー";
export const SUPPORT_INTRO_THANKS = "いつも、ニコニ広告・ギフトをいただきありがとうございます";
export const SUPPORT_OUTRO = "以上、支援いただきありがとうございます！";

export type SupportNarrationSpec = {
  key: string;
  text: string;
  scope: "intro" | "video" | "outro";
  videoId: string | null;
  giftId: number | null;
};

export const hasSupport = (cache: SupportCreditsCache | null | undefined) =>
  Boolean(cache?.videos.some((video) => video.gifts.length > 0 || video.advertisers.length > 0));

export function getSupportNarrationSpecs(cache: SupportCreditsCache | null | undefined): SupportNarrationSpec[] {
  if (!cache || !hasSupport(cache)) return [];
  const specs: SupportNarrationSpec[] = [
    { key: "intro:title", text: SUPPORT_INTRO_TITLE, scope: "intro", videoId: null, giftId: null },
    { key: "intro:thanks", text: SUPPORT_INTRO_THANKS, scope: "intro", videoId: null, giftId: null },
  ];

  for (const video of cache.videos) {
    const hasGifts = video.gifts.length > 0;
    const hasAds = video.advertisers.length > 0;
    if (!hasGifts && !hasAds) continue;
    const prefix = `video:${video.videoId}`;
    specs.push({ key: `${prefix}:title`, text: video.title, scope: "video", videoId: video.videoId, giftId: null });
    specs.push({ key: `${prefix}:lead`, text: "この動画は、", scope: "video", videoId: video.videoId, giftId: null });
    video.gifts.forEach((gift, index) => {
      const isLast = index === video.gifts.length - 1;
      const suffix = isLast ? (hasAds ? "と、" : "") : "、";
      specs.push({
        key: `${prefix}:gift:${gift.id}`,
        text: `${gift.supporterName}さん${suffix}`,
        scope: "video",
        videoId: video.videoId,
        giftId: gift.id,
      });
    });
    specs.push({
      key: `${prefix}:ending`,
      text: hasAds ? "ご覧の皆様に支えていただきました。" : "に支えていただきました。",
      scope: "video",
      videoId: video.videoId,
      giftId: null,
    });
  }
  specs.push({ key: "outro", text: SUPPORT_OUTRO, scope: "outro", videoId: null, giftId: null });
  return specs;
}

const resetAudio = (dialogue: Dialogue): Dialogue => ({
  ...dialogue,
  audio: { status: "idle", url: null, durationSeconds: null, error: null, inputHash: null },
});

export function reconcileSupportNarrations(
  cache: SupportCreditsCache | null,
  narratorCharacterId: string | null,
  current: SupportNarration[],
): SupportNarration[] {
  if (!narratorCharacterId) return [];
  const byKey = new Map(current.map((item) => [item.key, item]));
  return getSupportNarrationSpecs(cache).map((spec) => {
    const previous = byKey.get(spec.key);
    if (!previous) return { ...createDialogue(narratorCharacterId), key: spec.key, text: spec.text };
    const changed = previous.characterId !== narratorCharacterId || previous.text !== spec.text;
    const next = { ...previous, key: spec.key, characterId: narratorCharacterId, text: spec.text };
    return changed ? { ...resetAudio(next), key: spec.key } : next;
  });
}

export const isSupportCacheCurrent = (credits: SupportCredits) =>
  Boolean(
    credits.cache &&
    credits.cache.videos.length === credits.videos.length &&
    credits.cache.videos.every(
      (video, index) =>
        video.videoId === credits.videos[index].videoId && video.startDate === credits.videos[index].startDate,
    ),
  );

export type SupportCreditsGroup = {
  key: string;
  scope: "intro" | "video" | "outro";
  videoId: string | null;
  narrations: SupportNarration[];
  timing: ReturnType<typeof calculateBlock>;
};

export function getSupportCreditsGroups(
  credits: SupportCredits,
  characters: Character[],
  defaultEndHold?: number,
): SupportCreditsGroup[] {
  if (!isSupportCacheCurrent(credits) || !hasSupport(credits.cache)) return [];
  const narrations = new Map(credits.narrations.map((item) => [item.key, item]));
  const grouped = new Map<string, Omit<SupportCreditsGroup, "timing">>();
  for (const spec of getSupportNarrationSpecs(credits.cache)) {
    const narration = narrations.get(spec.key);
    if (!narration) continue;
    const key = spec.scope === "video" ? `video:${spec.videoId}` : spec.scope;
    const group = grouped.get(key) ?? {
      key,
      scope: spec.scope,
      videoId: spec.videoId,
      narrations: [],
    };
    group.narrations.push(narration);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => ({
    ...group,
    timing: calculateBlock(
      {
        id: `support-${group.key}`,
        title: "",
        asset: null,
        dialogues: group.narrations,
        durationSeconds: null,
        endHoldSeconds: null,
      },
      characters,
      defaultEndHold,
    ),
  }));
}

export function validateSupportCredits(credits: SupportCredits, characters: Character[]): TimelineIssue[] {
  if (credits.videos.length === 0) return [];
  const issues: TimelineIssue[] = [];
  const videoIds = credits.videos.map((video) => video.videoId);
  if (new Set(videoIds).size !== videoIds.length) {
    issues.push({ path: "supportCredits.videos", message: "紹介する動画IDが重複しています" });
  }
  if (!isSupportCacheCurrent(credits)) {
    issues.push({ path: "supportCredits.cache", message: "広告・ギフト情報を更新してください" });
    return issues;
  }
  if (!hasSupport(credits.cache)) return issues;
  const narrator = characters.find((character) => character.id === credits.narratorCharacterId);
  if (!narrator) {
    issues.push({
      path: "supportCredits.narratorCharacterId",
      message: "広告・ギフト紹介の読み上げ担当を選択してください",
    });
    return issues;
  }
  const byKey = new Map(credits.narrations.map((item) => [item.key, item]));
  for (const spec of getSupportNarrationSpecs(credits.cache)) {
    const narration = byKey.get(spec.key);
    if (!narration) {
      issues.push({ path: spec.key, message: "広告・ギフト紹介の音声情報が不足しています" });
      continue;
    }
    if (
      narration.characterId !== narrator.id ||
      narration.audio.status !== "ready" ||
      !narration.audio.url ||
      !narration.audio.durationSeconds
    ) {
      issues.push({ path: narration.id, message: "広告・ギフト紹介の音声生成が完了していません" });
    }
  }
  return issues;
}
