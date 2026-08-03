import type { AudioClip, AudioOverride } from "./types";

export function resolveSoundEffect(projectDefault: AudioClip | null, override?: AudioOverride): AudioClip | null {
  if (!override) return projectDefault;
  if (override.mode === "none") return null;
  if (override.mode === "custom") return override.clip;
  return projectDefault;
}

export const resolveAudioOverride = resolveSoundEffect;

export type AudioScene = {
  key: string;
  from: number;
  duration: number;
  bgm: AudioClip | null;
};

export type ContinuousBgmSegment = {
  key: string;
  from: number;
  duration: number;
  clip: AudioClip;
  volumeSections: Array<{ from: number; duration: number; volume: number }>;
};

export function groupContinuousBgm(scenes: AudioScene[]): ContinuousBgmSegment[] {
  const segments: ContinuousBgmSegment[] = [];
  let current: ContinuousBgmSegment | undefined;

  for (const scene of scenes) {
    if (!scene.bgm || scene.duration <= 0) {
      current = undefined;
      continue;
    }
    const isContinuous = current && current.from + current.duration === scene.from;
    const isSameAudio = current?.clip.assetId === scene.bgm.assetId;
    if (current && isContinuous && isSameAudio) {
      current.volumeSections.push({ from: current.duration, duration: scene.duration, volume: scene.bgm.volume });
      current.duration += scene.duration;
      continue;
    }
    current = {
      key: `${scene.key}-${scene.bgm.assetId}`,
      from: scene.from,
      duration: scene.duration,
      clip: scene.bgm,
      volumeSections: [{ from: 0, duration: scene.duration, volume: scene.bgm.volume }],
    };
    segments.push(current);
  }

  return segments;
}

export function getBgmVolume(segment: ContinuousBgmSegment, frame: number) {
  return (
    segment.volumeSections.find((section) => frame >= section.from && frame < section.from + section.duration)
      ?.volume ??
    segment.volumeSections.at(-1)?.volume ??
    segment.clip.volume
  );
}
