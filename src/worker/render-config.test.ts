import { describe, expect, it } from "vitest";
import {
  getProgressIntervalMs,
  getOffthreadVideoThreads,
  getPsdConcurrency,
  getRenderConcurrency,
  getRenderMediaCacheSize,
  getX264Preset,
} from "./render-config";

describe("render config", () => {
  it("uses latency-oriented defaults", () => {
    expect(getRenderConcurrency(undefined, 8)).toBe(6);
    expect(getX264Preset(undefined)).toBe("veryfast");
    expect(getRenderMediaCacheSize(undefined)).toBe(1024 * 1024 * 1024);
    expect(getOffthreadVideoThreads(undefined)).toBe(4);
    expect(getPsdConcurrency(undefined)).toBe(2);
    expect(getProgressIntervalMs(undefined)).toBe(750);
  });

  it("accepts concurrency percentages and integers", () => {
    expect(getRenderConcurrency("90%")).toBe("90%");
    expect(getRenderConcurrency("6")).toBe(6);
  });

  it("falls back from invalid values", () => {
    expect(getRenderConcurrency("nope", 8)).toBe(6);
    expect(getX264Preset("turbo")).toBe("veryfast");
  });
});
