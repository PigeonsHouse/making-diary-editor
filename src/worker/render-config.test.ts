import { describe, expect, it } from "vitest";
import {
  getProgressIntervalMs,
  getGpuVideoBitrate,
  getOffthreadVideoThreads,
  getPsdConcurrency,
  getRenderConcurrency,
  getRenderMediaCacheSize,
  getSoftwareCrf,
  getX264Preset,
} from "./render-config";

describe("render config", () => {
  it("uses latency-oriented defaults", () => {
    expect(getRenderConcurrency(undefined, 8)).toBe(6);
    expect(getX264Preset(undefined)).toBe("veryfast");
    expect(getSoftwareCrf(undefined)).toBe(15);
    expect(getGpuVideoBitrate(undefined)).toBe("12M");
    expect(getRenderMediaCacheSize(undefined)).toBe(2048 * 1024 * 1024);
    expect(getOffthreadVideoThreads(undefined)).toBe(8);
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
    expect(getSoftwareCrf("0")).toBe(15);
    expect(getSoftwareCrf("52")).toBe(15);
    expect(getGpuVideoBitrate("fast")).toBe("12M");
  });

  it("accepts software quality and GPU bitrate overrides", () => {
    expect(getSoftwareCrf("20")).toBe(20);
    expect(getGpuVideoBitrate("8M")).toBe("8M");
    expect(getGpuVideoBitrate("7500k")).toBe("7500k");
  });
});
