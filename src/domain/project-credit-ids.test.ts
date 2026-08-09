import { describe, expect, it } from "vitest";
import { createCharacter, createDiary, createProject } from "./defaults";
import { extractCreditIds, getProjectCreditIds, PROJECT_FIXED_CREDIT_IDS } from "./project-credit-ids";

describe("project credit IDs", () => {
  it("extracts supported IDs case-insensitively", () => {
    expect(extractCreditIds("SM12_sample-im34-nc56.png")).toEqual(["sm12", "im34", "nc56"]);
  });

  it("only extracts IDs from used assets and removes duplicates", () => {
    const project = createProject();
    project.audio.bgm = {
      assetId: "00000000-0000-4000-8000-000000000001",
      url: "/bgm",
      volumeOverride: null,
    };
    project.diaries = [createDiary()];
    const assets = [
      { id: "00000000-0000-4000-8000-000000000001", originalName: "music_sm12_nc34.mp3" },
      { id: "00000000-0000-4000-8000-000000000002", originalName: "unused_im56.png" },
    ];
    expect(getProjectCreditIds(project, [], assets)).toEqual([...PROJECT_FIXED_CREDIT_IDS, "sm12", "nc34"]);
  });

  it("includes IDs of project characters and deduplicates them", () => {
    const project = createProject();
    const character = createCharacter();
    character.creditIds = ["sm12", "nc34", "sm12"];
    project.characterIds = [character.id];
    expect(getProjectCreditIds(project, [character], [])).toEqual([...PROJECT_FIXED_CREDIT_IDS, "sm12", "nc34"]);
  });

  it("includes the support scene intro SE override", () => {
    const project = createProject();
    const assetId = "00000000-0000-4000-8000-000000000003";
    project.supportCredits.videos = [{ videoId: "sm123", startDate: null }];
    project.supportCredits.sceneIntroSe = {
      mode: "custom",
      clip: { assetId, url: "/support-se", volumeOverride: null },
    };
    project.supportCredits.cache = {
      fetchedAt: "2026-08-09T05:00:00.000Z",
      videos: [
        {
          videoId: "sm123",
          startDate: null,
          title: "動画",
          thumbnailUrl: "https://example.com/thumb.jpg",
          ownerName: "投稿者",
          advertisers: [{ supporterId: 1, supporterName: "広告主", totalPoint: 1 }],
          gifts: [],
        },
      ],
    };

    expect(getProjectCreditIds(project, [], [{ id: assetId, originalName: "support_nc78.wav" }])).toContain("nc78");
  });
});
