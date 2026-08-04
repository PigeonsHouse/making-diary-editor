import { describe, expect, it } from "vitest";
import { detectGpuCapabilities, getGpuMode, isHardwareEncodingError, resolveGpuUsage } from "./gpu-runtime";

describe("GPU runtime", () => {
  it("defaults unknown modes to auto", () => {
    expect(getGpuMode(undefined)).toBe("auto");
    expect(getGpuMode("unexpected")).toBe("auto");
    expect(getGpuMode("off")).toBe("off");
    expect(getGpuMode("required")).toBe("required");
  });

  it("detects an NVIDIA GPU passed into a Linux container", () => {
    const capabilities = detectGpuCapabilities({
      platform: "linux",
      deviceExists: (path) => path === "/dev/nvidia0",
      nvidiaSmiWorks: () => true,
    });
    expect(capabilities).toMatchObject({ hardwareEncoding: true, chromiumRendering: true });
  });

  it("keeps a CPU-only Linux container on the software path", () => {
    const capabilities = detectGpuCapabilities({
      platform: "linux",
      deviceExists: () => false,
      nvidiaSmiWorks: () => false,
    });
    expect(resolveGpuUsage("auto", capabilities)).toEqual({
      hardwareEncoding: false,
      chromiumRendering: false,
    });
  });

  it("can use a Linux render device without enabling NVENC", () => {
    const capabilities = detectGpuCapabilities({
      platform: "linux",
      deviceExists: (path) => path === "/dev/dri/renderD128",
      nvidiaSmiWorks: () => false,
    });
    expect(resolveGpuUsage("auto", capabilities)).toEqual({
      hardwareEncoding: false,
      chromiumRendering: true,
    });
  });

  it("fails early when GPU use is required but unavailable", () => {
    expect(() =>
      resolveGpuUsage("required", {
        hardwareEncoding: false,
        chromiumRendering: false,
        source: "test",
      }),
    ).toThrow(/required/);
  });

  it("recognizes NVENC runtime failures for automatic retry", () => {
    expect(isHardwareEncodingError(new Error("Cannot load libcuda.so.1"))).toBe(true);
    expect(isHardwareEncodingError(new Error("A React component crashed"))).toBe(false);
  });
});
