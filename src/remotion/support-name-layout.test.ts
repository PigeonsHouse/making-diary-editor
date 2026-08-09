import { describe, expect, it } from "vitest";
import {
  getSupportNameLayout,
  SUPPORT_LIST_VIEWPORT_HEIGHT,
  SUPPORT_NAME_MAX_FONT_SIZE,
  SUPPORT_NAME_MIN_FONT_SIZE,
} from "./support-name-layout";

describe("support name layout", () => {
  it("fits short gift lists at the enlarged maximum size", () => {
    const layout = getSupportNameLayout(5, "gift");
    expect(layout.fontSize).toBe(SUPPORT_NAME_MAX_FONT_SIZE);
    expect(layout.rowHeight * 5).toBeLessThanOrEqual(SUPPORT_LIST_VIEWPORT_HEIGHT);
    expect(layout.scroll).toBe(false);
  });

  it("shrinks a slightly overflowing list until every name fits", () => {
    const layout = getSupportNameLayout(14, "ad");
    expect(layout.fontSize).toBeGreaterThanOrEqual(SUPPORT_NAME_MIN_FONT_SIZE);
    expect(layout.rowHeight * 14).toBeLessThanOrEqual(SUPPORT_LIST_VIEWPORT_HEIGHT);
    expect(layout.scroll).toBe(false);
  });

  it("accounts for rounded line heights when fitting gift names", () => {
    const layout = getSupportNameLayout(7, "gift");
    expect(layout.rowHeight * 7).toBeLessThanOrEqual(SUPPORT_LIST_VIEWPORT_HEIGHT);
    expect(layout.scroll).toBe(false);
  });

  it("shows a clear multi-row overflow once the minimum-size fit is impossible", () => {
    const layout = getSupportNameLayout(15, "ad");
    const overflow = layout.rowHeight * 15 - SUPPORT_LIST_VIEWPORT_HEIGHT;
    expect(layout.scroll).toBe(true);
    expect(overflow).toBeGreaterThanOrEqual(layout.rowHeight * 1.5);
  });
});
