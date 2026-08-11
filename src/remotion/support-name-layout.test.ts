import { describe, expect, it } from "vitest";
import {
  getSupportNameLayout,
  getSupportNameScrollOffset,
  SUPPORT_LIST_VIEWPORT_HEIGHT,
  SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE,
  SUPPORT_NAME_MAX_FONT_SIZE,
  SUPPORT_NAME_MIN_SCROLL_PX_PER_FRAME,
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

describe("ad-only support name layout", () => {
  it("falls back from maximum-size single-column to two-column layout", () => {
    expect(getSupportNameLayout(5, "ad", true)).toMatchObject({
      fontSize: SUPPORT_NAME_MAX_FONT_SIZE,
      columns: 1,
      scroll: false,
    });
    expect(getSupportNameLayout(10, "ad", true)).toMatchObject({
      fontSize: SUPPORT_NAME_MAX_FONT_SIZE,
      columns: 2,
      scroll: false,
    });
  });

  it("shrinks the two-column font before falling back to three columns", () => {
    const twoColumns = getSupportNameLayout(12, "ad", true);
    expect(twoColumns.columns).toBe(2);
    expect(twoColumns.fontSize).toBeLessThan(SUPPORT_NAME_MAX_FONT_SIZE);
    expect(twoColumns.fontSize).toBeGreaterThanOrEqual(SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE);

    expect(getSupportNameLayout(18, "ad", true)).toMatchObject({
      fontSize: SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE,
      columns: 3,
      scroll: false,
    });
  });

  it("shrinks three-column text to the minimum before enabling scrolling", () => {
    const reduced = getSupportNameLayout(30, "ad", true);
    expect(reduced.columns).toBe(3);
    expect(reduced.fontSize).toBeLessThan(SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE);
    expect(reduced.fontSize).toBeGreaterThanOrEqual(SUPPORT_NAME_MIN_FONT_SIZE);
    expect(reduced.scroll).toBe(false);

    expect(getSupportNameLayout(43, "ad", true)).toMatchObject({
      fontSize: SUPPORT_NAME_MIN_FONT_SIZE,
      columns: 3,
      scroll: true,
    });
  });
});

describe("support name scrolling", () => {
  it("keeps the natural speed when it is faster than the minimum", () => {
    expect(getSupportNameScrollOffset(25, 101, 500)).toBe(125);
  });

  it("uses the minimum speed when scrolling across the full duration would be too slow", () => {
    expect(getSupportNameScrollOffset(10, 301, 100)).toBe(10 * SUPPORT_NAME_MIN_SCROLL_PX_PER_FRAME);
  });

  it("stays at the end after scrolling has finished", () => {
    expect(getSupportNameScrollOffset(200, 301, 100)).toBe(100);
  });
});
