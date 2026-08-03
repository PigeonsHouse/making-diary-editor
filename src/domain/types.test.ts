import { describe, expect, it } from "vitest";
import { contentBlockSchema, diaryEntrySchema, dialogueSchema, projectDocumentSchema } from "./types";

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
