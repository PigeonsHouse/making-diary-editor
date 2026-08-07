import { describe, expect, it } from "vitest";
import { calculateDetailedRenderProgress } from "./render-progress-value";

describe("calculateDetailedRenderProgress", () => {
  it("retains sub-percent precision from Remotion frame counters", () => {
    const progress = calculateDetailedRenderProgress(
      { renderedFrames: 1_458, encodedFrames: 1_142, progress: 0.05 },
      25_872,
    );

    expect(progress * 100).toBeCloseTo(5.27, 2);
  });

  it("reaches completion and clamps invalid frame counts", () => {
    expect(calculateDetailedRenderProgress({ renderedFrames: 100, encodedFrames: 100, progress: 1 }, 100)).toBe(1);
    expect(calculateDetailedRenderProgress({ renderedFrames: 120, encodedFrames: 120, progress: 1 }, 100)).toBe(1);
  });

  it("falls back to Remotion progress when the total is unavailable", () => {
    expect(calculateDetailedRenderProgress({ renderedFrames: 0, encodedFrames: 0, progress: 0.42 }, 0)).toBe(0.42);
  });
});
