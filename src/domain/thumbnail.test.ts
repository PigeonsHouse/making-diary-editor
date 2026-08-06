import { describe, expect, it } from "vitest";
import { thumbnailElementSchema } from "./types";
import { getCumulativeOutlineLayers, getRoundedOutlineTextShadow, getThumbnailAnchorTransform } from "./thumbnail";

describe("thumbnail outlines", () => {
  it("stacks outlines outward using cumulative widths", () => {
    expect(
      getCumulativeOutlineLayers([
        { width: 8, color: "#000000" },
        { width: 8, color: "#ffffff" },
        { width: 4, color: "#ff0000" },
      ]),
    ).toEqual([
      { index: 2, width: 20, color: "#ff0000" },
      { index: 1, width: 16, color: "#ffffff" },
      { index: 0, width: 8, color: "#000000" },
    ]);
  });

  it("creates a circular shadow instead of sharp stroke joins", () => {
    const shadow = getRoundedOutlineTextShadow(8, "#123456", 4);
    expect(shadow.split(", ")).toHaveLength(4);
    expect(shadow).toContain("#123456");
    expect(shadow).not.toContain("none");
  });

  it("positions elements from the selected anchor", () => {
    expect(getThumbnailAnchorTransform("top-left")).toEqual({ translate: "0% 0%", transformOrigin: "0% 0%" });
    expect(getThumbnailAnchorTransform("center")).toEqual({ translate: "-50% -50%", transformOrigin: "50% 50%" });
    expect(getThumbnailAnchorTransform("bottom-right")).toEqual({
      translate: "-100% -100%",
      transformOrigin: "100% 100%",
    });
  });

  it("migrates legacy text outlines into the ordered effect stack", () => {
    const element = thumbnailElementSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      type: "text",
      text: "title",
      color: "#ffffff",
      fontSize: 120,
      outlines: [{ width: 8, color: "#000000" }],
    });
    expect(element.effects).toEqual([{ id: "legacy-outline-0", type: "outline", width: 8, color: "#000000" }]);
  });
});
