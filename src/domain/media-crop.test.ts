import { describe, expect, it } from "vitest";
import { calculateCroppedMediaLayout, getMaximumTrim } from "./media-crop";

describe("calculateCroppedMediaLayout", () => {
  it("素材端から切り抜いた矩形を表示枠いっぱいに拡大して中央配置する", () => {
    expect(
      calculateCroppedMediaLayout({
        sourceWidth: 1000,
        sourceHeight: 800,
        trim: { top: 100, right: 100, bottom: 100, left: 100 },
        targetWidth: 1600,
        targetHeight: 1200,
      }),
    ).toEqual({
      viewportWidth: 1600,
      viewportHeight: 1200,
      mediaWidth: 2000,
      mediaHeight: 1600,
      mediaLeft: -200,
      mediaTop: -200,
    });
  });

  it("切り抜き後の縦横比を維持して表示枠内に収める", () => {
    expect(
      calculateCroppedMediaLayout({
        sourceWidth: 1920,
        sourceHeight: 1080,
        trim: { top: 0, right: 320, bottom: 0, left: 320 },
        targetWidth: 1000,
        targetHeight: 1000,
      }),
    ).toEqual({
      viewportWidth: 1000,
      viewportHeight: 843.75,
      mediaWidth: 1500,
      mediaHeight: 843.75,
      mediaLeft: -250,
      mediaTop: -0,
    });
  });

  it("過剰な切り抜き値でも最低1pxを残す", () => {
    const layout = calculateCroppedMediaLayout({
      sourceWidth: 100,
      sourceHeight: 50,
      trim: { top: 100, right: 100, bottom: 100, left: 100 },
      targetWidth: 200,
      targetHeight: 100,
    });
    expect(layout?.viewportWidth).toBe(100);
    expect(layout?.viewportHeight).toBe(100);
  });
});

describe("getMaximumTrim", () => {
  it("反対側の切り抜き量を差し引いて1px以上を残す", () => {
    const trim = { top: 10, right: 20, bottom: 30, left: 40 };
    expect(getMaximumTrim("left", trim, 100, 80)).toBe(79);
    expect(getMaximumTrim("right", trim, 100, 80)).toBe(59);
    expect(getMaximumTrim("top", trim, 100, 80)).toBe(49);
    expect(getMaximumTrim("bottom", trim, 100, 80)).toBe(69);
  });
});
