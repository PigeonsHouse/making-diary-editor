import { describe, expect, it } from "vitest";
import { createDiary, createProject } from "../../domain/defaults";
import { getPreviewProject } from "./preview-project";

describe("getPreviewProject", () => {
  it("keeps the complete project for general settings", () => {
    const project = createProject();
    project.wishList = {
      markdown: "wish",
      dialogues: [],
      durationSeconds: 3,
      endHoldSeconds: null,
      sceneIntroSe: { mode: "inherit" },
      bgm: { mode: "inherit" },
    };
    project.diaries = [createDiary(), createDiary()];

    expect(getPreviewProject(project, "general")).toBe(project);
  });

  it("keeps only the wish list for its tab", () => {
    const project = createProject();
    project.wishList = {
      markdown: "wish",
      dialogues: [],
      durationSeconds: 3,
      endHoldSeconds: null,
      sceneIntroSe: { mode: "inherit" },
      bgm: { mode: "inherit" },
    };
    project.diaries = [createDiary()];

    const preview = getPreviewProject(project, "wish");
    expect(preview.wishList).toBe(project.wishList);
    expect(preview.diaries).toEqual([]);
  });

  it("keeps only the selected diary for a diary tab", () => {
    const project = createProject();
    project.wishList = {
      markdown: "wish",
      dialogues: [],
      durationSeconds: 3,
      endHoldSeconds: null,
      sceneIntroSe: { mode: "inherit" },
      bgm: { mode: "inherit" },
    };
    project.diaries = [createDiary(), createDiary()];

    const selected = project.diaries[1];
    const preview = getPreviewProject(project, `diary:${selected.id}`);
    expect(preview.wishList).toBeNull();
    expect(preview.diaries).toEqual([selected]);
    expect(preview.supportCredits.cache).toBeNull();
  });

  it("keeps only support credits for the support tab", () => {
    const project = createProject();
    project.wishList = {
      markdown: "wish",
      dialogues: [],
      durationSeconds: 3,
      endHoldSeconds: null,
      sceneIntroSe: { mode: "inherit" },
      bgm: { mode: "inherit" },
    };
    project.diaries = [createDiary()];

    const preview = getPreviewProject(project, "support");
    expect(preview.wishList).toBeNull();
    expect(preview.diaries).toEqual([]);
    expect(preview.supportCredits).toBe(project.supportCredits);
  });
});
