import { describe, expect, it } from "vitest";
import { getSupportNarrationSpecs, isSupportCacheCurrent, reconcileSupportNarrations } from "./support-credits";
import type { SupportCreditsCache } from "./types";

const cache: SupportCreditsCache = {
  fetchedAt: "2026-08-09T05:00:00.000Z",
  videos: [
    {
      videoId: "sm123",
      startDate: "2026-08-01",
      title: "動画タイトル",
      thumbnailUrl: "https://example.com/thumb.jpg",
      ownerName: "投稿者",
      advertisers: [{ supporterId: 1, supporterName: "広告主", totalPoint: 100 }],
      gifts: [
        { id: 10, supporterId: 2, supporterName: "甲", publishedAt: 100 },
        { id: 11, supporterId: 3, supporterName: "乙", publishedAt: 200 },
      ],
    },
  ],
};

describe("support narration", () => {
  it("splits gift and advertising narration into stable units", () => {
    const specs = getSupportNarrationSpecs(cache);
    expect(specs.map((item) => item.text)).toEqual([
      "広告・ギフト紹介のコーナー",
      "いつも、ニコニ広告・ギフトをいただきありがとうございます",
      "動画タイトル",
      "この動画は、",
      "甲さん、",
      "乙さんと、",
      "ご覧の皆様に支えていただきました。",
      "以上、支援いただきありがとうございます！",
    ]);
  });

  it("uses the gift-only ending without advertising wording", () => {
    const giftOnly = structuredClone(cache);
    giftOnly.videos[0].advertisers = [];
    expect(
      getSupportNarrationSpecs(giftOnly)
        .map((item) => item.text)
        .slice(-4),
    ).toEqual(["甲さん、", "乙さん", "に支えていただきました。", "以上、支援いただきありがとうございます！"]);
  });

  it("omits videos and the whole corner when no support exists", () => {
    const empty = structuredClone(cache);
    empty.videos[0].advertisers = [];
    empty.videos[0].gifts = [];
    expect(getSupportNarrationSpecs(empty)).toEqual([]);
  });

  it("preserves tuning by key and invalidates audio when source text changes", () => {
    const narrator = "00000000-0000-4000-8000-000000000001";
    const initial = reconcileSupportNarrations(cache, narrator, []);
    initial[4].kana = "コー";
    initial[4].audio = { status: "ready", url: "/audio.wav", durationSeconds: 1, error: null, inputHash: "x" };
    const changed = structuredClone(cache);
    changed.videos[0].gifts[0].supporterName = "甲さん";
    const reconciled = reconcileSupportNarrations(changed, narrator, initial);
    expect(reconciled[4].kana).toBe("コー");
    expect(reconciled[4].audio.status).toBe("idle");
  });

  it("detects stale cache inputs", () => {
    expect(
      isSupportCacheCurrent({
        narratorCharacterId: null,
        videos: [{ videoId: "sm123", startDate: "2026-08-01" }],
        bgm: { mode: "inherit" },
        sceneIntroSe: { mode: "inherit" },
        cache,
        narrations: [],
      }),
    ).toBe(true);
    expect(
      isSupportCacheCurrent({
        narratorCharacterId: null,
        videos: [{ videoId: "sm123", startDate: null }],
        bgm: { mode: "inherit" },
        sceneIntroSe: { mode: "inherit" },
        cache,
        narrations: [],
      }),
    ).toBe(false);
  });
});
