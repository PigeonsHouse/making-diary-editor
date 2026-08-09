import { describe, expect, it } from "vitest";
import {
  assetSettingsSchema,
  audioClipSchema,
  contentBlockSchema,
  diaryEntrySchema,
  dialogueSchema,
  projectDocumentSchema,
  supportCreditsSchema,
} from "./types";

describe("dialogueSchema", () => {
  it("未指定の音声上書きへキャラクター既定相当の値を補完しない", () => {
    const dialogue = dialogueSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      text: "テスト",
      voiceOverrides: {},
      psdOverrides: {},
      audio: {},
    });

    expect(dialogue.voiceOverrides).toEqual({});
  });
});

describe("audio setting defaults", () => {
  it("treats legacy 100% as the asset default and preserves non-100% overrides", () => {
    const clipBase = { assetId: "00000000-0000-4000-8000-000000000006", url: "/audio" };
    expect(audioClipSchema.parse({ ...clipBase, volume: 1 }).volumeOverride).toBeNull();
    expect(audioClipSchema.parse({ ...clipBase, volume: 0.4 }).volumeOverride).toBe(0.4);
    expect(audioClipSchema.parse({ ...clipBase, volumeOverride: 1 }).volumeOverride).toBe(1);

    const videoBase = {
      assetId: "00000000-0000-4000-8000-000000000007",
      type: "video",
      url: "/video",
      trim: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    expect(assetSettingsSchema.parse({ ...videoBase, volume: 1 }).volumeOverride).toBeNull();
    expect(assetSettingsSchema.parse({ ...videoBase, volume: 0.65 }).volumeOverride).toBe(0.65);
    expect(assetSettingsSchema.parse(videoBase).chromaKey).toEqual({
      enabled: false,
      color: "#00ff00",
      similarity: 0.15,
      edgeBlur: 2,
    });
    expect(
      assetSettingsSchema.parse({
        ...videoBase,
        chromaKey: { enabled: true, color: "#00ff00", similarity: 0.2, smoothness: 0.08 },
      }).chromaKey,
    ).toEqual({ enabled: true, color: "#00ff00", similarity: 0.2, edgeBlur: 2 });
  });

  it("adds project audio defaults to existing documents", () => {
    const project = projectDocumentSchema.parse({ name: "既存プロジェクト" });
    expect(project.audio).toEqual({ bgm: null, sceneIntroSe: null, contentSe: null });
    expect(project.supportCredits).toEqual({
      narratorCharacterId: null,
      videos: [],
      bgm: { mode: "inherit" },
      sceneIntroSe: { mode: "inherit" },
      cache: null,
      narrations: [],
    });
  });

  it("migrates the shared support period to each configured and cached video", () => {
    const credits = supportCreditsSchema.parse({
      videoIds: ["sm123"],
      startDate: "2026-08-01",
      cache: {
        fetchedAt: "2026-08-09T05:00:00.000Z",
        startDate: "2026-08-01",
        videos: [
          {
            videoId: "sm123",
            title: "動画タイトル",
            thumbnailUrl: "https://example.com/thumb.jpg",
            advertisers: [],
            gifts: [],
          },
        ],
      },
    });

    expect(credits.videos).toEqual([{ videoId: "sm123", startDate: "2026-08-01" }]);
    expect(credits.cache?.videos[0].startDate).toBe("2026-08-01");
    expect(credits.bgm).toEqual({ mode: "inherit" });
    expect(credits.sceneIntroSe).toEqual({ mode: "inherit" });
  });

  it("migrates generated support endings to the new wording", () => {
    const credits = supportCreditsSchema.parse({
      narrations: [
        {
          key: "video:sm123:ending",
          id: "00000000-0000-4000-8000-000000000010",
          characterId: "00000000-0000-4000-8000-000000000011",
          text: "ご覧の皆様に支えられております。",
          kana: "ゴランノミナサマニササエラレテオリマス'。",
          audio: {
            status: "ready",
            url: "/old.wav",
            durationSeconds: 1,
            error: null,
            inputHash: "old",
          },
        },
      ],
    });

    expect(credits.narrations[0].text).toBe("ご覧の皆様に支えていただきました。");
    expect(credits.narrations[0].kana).toBeNull();
    expect(credits.narrations[0].audio.status).toBe("idle");
  });

  it("makes diary and content SE settings inherit by default", () => {
    const block = contentBlockSchema.parse({ id: "00000000-0000-4000-8000-000000000003" });
    const diary = diaryEntrySchema.parse({
      id: "00000000-0000-4000-8000-000000000004",
      date: "2026-08-03",
      blocks: [block],
    });
    expect(diary.sceneIntroSe).toEqual({ mode: "inherit" });
    expect(diary.bgm).toEqual({ mode: "inherit" });
    expect(diary.blocks[0].entrySe).toEqual({ mode: "inherit" });
  });

  it("migrates the old date SE field to the scene intro SE field", () => {
    const project = projectDocumentSchema.parse({
      name: "既存プロジェクト",
      audio: { bgm: null, dateSe: null, contentSe: null },
      diaries: [
        {
          id: "00000000-0000-4000-8000-000000000005",
          date: "2026-08-03",
          dateSe: { mode: "none" },
        },
      ],
    });
    expect(project.audio.sceneIntroSe).toBeNull();
    expect(project.diaries[0].sceneIntroSe).toEqual({ mode: "none" });
    expect(project.diaries[0]).not.toHaveProperty("dateSe");
  });
});
