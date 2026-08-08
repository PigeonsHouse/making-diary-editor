import type { AudioClip, AudioOverride } from "./types";

export type AssetVolumeMap = Readonly<Record<string, number>>;
export type ResolvedAudioClip = Omit<AudioClip, "volumeOverride"> & { volume: number };

export function resolveAssetVolume(assetId: string, volumeOverride: number | null, assetVolumes: AssetVolumeMap = {}) {
  return volumeOverride ?? assetVolumes[assetId] ?? 1;
}

export function resolveAudioClip(clip: AudioClip, assetVolumes: AssetVolumeMap = {}): ResolvedAudioClip {
  return {
    assetId: clip.assetId,
    url: clip.url,
    volume: resolveAssetVolume(clip.assetId, clip.volumeOverride, assetVolumes),
  };
}

export function resolveSoundEffect(
  projectDefault: AudioClip | null,
  override?: AudioOverride,
  assetVolumes: AssetVolumeMap = {},
): ResolvedAudioClip | null {
  const clip = !override
    ? projectDefault
    : override.mode === "none"
      ? null
      : override.mode === "custom"
        ? override.clip
        : projectDefault;
  return clip ? resolveAudioClip(clip, assetVolumes) : null;
}

export const resolveAudioOverride = resolveSoundEffect;

export type AudioScene = {
  key: string;
  from: number;
  duration: number;
  bgm: ResolvedAudioClip | null;
};

export type ContinuousBgmSegment = {
  key: string;
  from: number;
  duration: number;
  clip: ResolvedAudioClip;
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
