import { describe, expect, it } from "vitest";
import {
  assetSettingsSchema,
  audioClipSchema,
  contentBlockSchema,
  diaryEntrySchema,
  dialogueSchema,
  projectDocumentSchema,
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
  });

  it("adds project audio defaults to existing documents", () => {
    const project = projectDocumentSchema.parse({ name: "既存プロジェクト" });
    expect(project.audio).toEqual({ bgm: null, sceneIntroSe: null, contentSe: null });
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
