import { describe, expect, it } from "vitest";
import { assetMetadataHasAlpha, createAssetTransparencyMap } from "./asset-transparency";

describe("asset transparency", () => {
  it("only accepts an explicit boolean alpha marker", () => {
    expect(assetMetadataHasAlpha({ hasAlpha: true })).toBe(true);
    expect(assetMetadataHasAlpha({ hasAlpha: false })).toBe(false);
    expect(assetMetadataHasAlpha({ hasAlpha: "true" })).toBe(false);
    expect(assetMetadataHasAlpha(null)).toBe(false);
  });

  it("creates a sparse map containing transparent assets", () => {
    expect(
      createAssetTransparencyMap([
        { id: "transparent", metadata: { hasAlpha: true } },
        { id: "opaque", metadata: { hasAlpha: false } },
      ]),
    ).toEqual({ transparent: true });
  });
});
