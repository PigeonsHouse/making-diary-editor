import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export type GpuMode = "auto" | "off" | "required";

export type GpuCapabilities = {
  hardwareEncoding: boolean;
  chromiumRendering: boolean;
  source: string;
};

type DetectGpuOptions = {
  platform?: NodeJS.Platform;
  deviceExists?: (path: string) => boolean;
  nvidiaSmiWorks?: () => boolean;
};

const canRunNvidiaSmi = () => {
  const result = spawnSync("nvidia-smi", ["-L"], {
    encoding: "utf8",
    stdio: "ignore",
    timeout: 5_000,
    windowsHide: true,
  });
  return result.status === 0;
};

export function getGpuMode(value = process.env.RENDER_GPU_MODE): GpuMode {
  return value === "off" || value === "required" ? value : "auto";
}

export function detectGpuCapabilities({
  platform = process.platform,
  deviceExists = existsSync,
  nvidiaSmiWorks = canRunNvidiaSmi,
}: DetectGpuOptions = {}): GpuCapabilities {
  if (platform === "darwin") {
    return { hardwareEncoding: true, chromiumRendering: true, source: "macOS GPU / VideoToolbox" };
  }

  const nvidiaAvailable = nvidiaSmiWorks();
  if (platform === "win32") {
    return {
      hardwareEncoding: nvidiaAvailable,
      chromiumRendering: nvidiaAvailable,
      source: nvidiaAvailable ? "NVIDIA GPU" : "no supported GPU detected",
    };
  }

  if (platform === "linux") {
    const nvidiaDevice = deviceExists("/dev/nvidia0") || deviceExists("/dev/nvidiactl") || deviceExists("/dev/dxg");
    const renderDevice = deviceExists("/dev/dri/renderD128") || deviceExists("/dev/dri/card0");
    const hardwareEncoding = nvidiaAvailable && nvidiaDevice;
    const chromiumRendering = hardwareEncoding || renderDevice;
    return {
      hardwareEncoding,
      chromiumRendering,
      source: hardwareEncoding
        ? "NVIDIA container GPU"
        : renderDevice
          ? "Linux render device"
          : "no container GPU device detected",
    };
  }

  return { hardwareEncoding: false, chromiumRendering: false, source: `unsupported platform: ${platform}` };
}

export function resolveGpuUsage(mode: GpuMode, capabilities: GpuCapabilities) {
  if (mode === "off") return { hardwareEncoding: false, chromiumRendering: false };
  if (mode === "required" && (!capabilities.hardwareEncoding || !capabilities.chromiumRendering)) {
    throw new Error(
      `GPU mode is required, but both GPU encoding and rendering are unavailable (${capabilities.source})`,
    );
  }
  return {
    hardwareEncoding: capabilities.hardwareEncoding,
    chromiumRendering: capabilities.chromiumRendering,
  };
}

export function isHardwareEncodingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:nvenc|nvidia|cuda|hardware acceleration|no capable devices|cannot load libcuda)/i.test(message);
}
