import { describe, expect, it } from "vitest";
import type { AssetSettings } from "./types";
import { getVideoAssetTiming, getVideoPlaybackRateError } from "./video-asset";

const asset = (overrides: Partial<AssetSettings> = {}): AssetSettings => ({
  assetId: "00000000-0000-4000-8000-000000000001",
  type: "video",
  url: "/video.mp4",
  displayArea: "full",
  sourceDurationSeconds: 10,
  trim: { top: 0, right: 0, bottom: 0, left: 0 },
  chromaKey: { enabled: false, color: "#00ff00", similarity: 0.15, smoothness: 0.08 },
  startSeconds: 2,
  endSeconds: 6,
  volumeOverride: null,
  shortageMode: "freeze",
  fadeOutSeconds: null,
  ...overrides,
});

describe("getVideoAssetTiming", () => {
  it("開始・終了秒を通常速度のフレーム範囲へ変換する", () => {
    expect(getVideoAssetTiming(asset(), 8, 30)).toEqual({
      clipDurationSeconds: 4,
      clipDurationInFrames: 120,
      playbackRate: 1,
      trimBefore: 60,
      trimAfter: 180,
    });
  });

  it("尺に合わせる場合はクリップ全体がブロック尺に収まる再生速度にする", () => {
    expect(getVideoAssetTiming(asset({ shortageMode: "fit-duration" }), 8, 30)).toEqual({
      clipDurationSeconds: 4,
      clipDurationInFrames: 240,
      playbackRate: 0.5,
      trimBefore: 60,
      trimAfter: 300,
    });
  });

  it("倍速にかかわらず指定したクリップ開始位置から再生する", () => {
    const timing = getVideoAssetTiming(
      asset({ startSeconds: 300, endSeconds: 400, sourceDurationSeconds: 400, shortageMode: "fit-duration" }),
      10,
      30,
    );

    expect(timing.playbackRate).toBe(10);
    expect(timing.trimBefore / 30).toBe(300);
    expect((timing.trimBefore + 5 * 30 * timing.playbackRate) / 30).toBe(350);
    expect(((timing.trimAfter! - timing.trimBefore) * timing.playbackRate) / 30).toBe(100);
  });

  it("ブラウザの対応範囲を超える再生速度をエラーにする", () => {
    expect(getVideoPlaybackRateError(asset({ shortageMode: "fit-duration" }), 0.01, 30)).toContain("対応範囲外");
    expect(getVideoPlaybackRateError(asset({ shortageMode: "fit-duration" }), 8, 30)).toBeNull();
  });
});
