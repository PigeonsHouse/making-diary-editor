import { describe, expect, it } from "vitest";
import { projectDocumentSchema } from "../../domain/types";
import { fillMissingAssetMetadata } from "./project-document";
import type { AssetRow } from "./types";

describe("fillMissingAssetMetadata", () => {
  it("既存の画像設定へ素材の幅と高さを補完する", () => {
    const assetId = "00000000-0000-4000-8000-000000000001";
    const document = projectDocumentSchema.parse({
      name: "既存プロジェクト",
      diaries: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          date: "2026-08-11",
          blocks: [
            {
              id: "00000000-0000-4000-8000-000000000003",
              asset: {
                assetId,
                type: "image",
                url: `/api/files/assets/${assetId}`,
                trim: { top: 10, right: 20, bottom: 30, left: 40 },
              },
            },
          ],
        },
      ],
    });
    const assets: AssetRow[] = [
      {
        id: assetId,
        projectId: null,
        kind: "image",
        originalName: "image.png",
        status: "ready",
        defaultVolume: 1,
        metadata: { streams: [{ width: 1200, height: 800 }] },
        error: null,
      },
    ];

    const result = fillMissingAssetMetadata(document, assets);

    expect(result.changed).toBe(true);
    expect(result.document.diaries[0].blocks[0].asset).toMatchObject({
      sourceWidth: 1200,
      sourceHeight: 800,
    });
    expect(document.diaries[0].blocks[0].asset).toMatchObject({ sourceWidth: null, sourceHeight: null });
  });
});
