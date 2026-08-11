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
  mutedSections?: Array<{ from: number; duration: number }>;
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
    const sections = createSceneVolumeSections(scene);
    if (current && isContinuous && isSameAudio) {
      const offset = current.duration;
      current.volumeSections.push(...sections.map((section) => ({ ...section, from: offset + section.from })));
      current.duration += scene.duration;
      continue;
    }
    current = {
      key: `${scene.key}-${scene.bgm.assetId}`,
      from: scene.from,
      duration: scene.duration,
      clip: scene.bgm,
      volumeSections: sections,
    };
    segments.push(current);
  }

  return segments;
}

function createSceneVolumeSections(scene: AudioScene) {
  const mutedSections = (scene.mutedSections ?? [])
    .map((section) => ({
      from: Math.max(0, Math.min(scene.duration, section.from)),
      end: Math.max(0, Math.min(scene.duration, section.from + section.duration)),
    }))
    .filter((section) => section.end > section.from);
  const boundaries = [
    ...new Set([0, scene.duration, ...mutedSections.flatMap((section) => [section.from, section.end])]),
  ].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((from, index) => {
    const end = boundaries[index + 1];
    const muted = mutedSections.some((section) => from >= section.from && from < section.end);
    return { from, duration: end - from, volume: muted ? 0 : scene.bgm!.volume };
  });
}

export function getBgmVolume(segment: ContinuousBgmSegment, frame: number) {
  return (
    segment.volumeSections.find((section) => frame >= section.from && frame < section.from + section.duration)
      ?.volume ??
    segment.volumeSections.at(-1)?.volume ??
    segment.clip.volume
  );
}
