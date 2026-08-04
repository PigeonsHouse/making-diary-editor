import { availableParallelism } from "node:os";
import type { Bitrate } from "@remotion/renderer";

const X264_PRESETS = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
  "veryslow",
  "placebo",
] as const;

export type X264Preset = (typeof X264_PRESETS)[number];

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const automaticConcurrency = (cpuCount: number) => Math.min(12, Math.max(1, Math.floor(cpuCount * 0.75)));

export function getRenderConcurrency(
  value = process.env.RENDER_CONCURRENCY,
  cpuCount = availableParallelism(),
): string | number {
  if (!value || value === "auto") return automaticConcurrency(cpuCount);
  if (/^(?:[1-9]|[1-9]\d|100)%$/.test(value)) return value;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : automaticConcurrency(cpuCount);
}

export function getX264Preset(value = process.env.RENDER_X264_PRESET): X264Preset {
  return X264_PRESETS.includes(value as X264Preset) ? (value as X264Preset) : "veryfast";
}

export function getSoftwareCrf(value = process.env.RENDER_SOFTWARE_CRF) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 51 ? parsed : 15;
}

export function getGpuVideoBitrate(value = process.env.RENDER_GPU_VIDEO_BITRATE): Bitrate {
  return /^\d+(?:\.\d+)?[kKM]$/.test(value ?? "") ? (value as Bitrate) : "12M";
}

export function getRenderMediaCacheSize(value = process.env.RENDER_MEDIA_CACHE_MB) {
  return positiveInteger(value, 2048) * 1024 * 1024;
}

export function getOffthreadVideoThreads(value = process.env.RENDER_OFFTHREAD_VIDEO_THREADS) {
  return positiveInteger(value, 8);
}

export function getPsdConcurrency(value = process.env.RENDER_PSD_CONCURRENCY) {
  return positiveInteger(value, 2);
}

export function getProgressIntervalMs(value = process.env.RENDER_PROGRESS_INTERVAL_MS) {
  return positiveInteger(value, 750);
}
