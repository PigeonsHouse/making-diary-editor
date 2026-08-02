import type { AssetSettings } from "./types";

export const VIDEO_PLAYBACK_RATE_RANGE = { min: 0.0625, max: 16 } as const;

export type VideoAssetTiming = {
  clipDurationSeconds: number | null;
  clipDurationInFrames: number | null;
  playbackRate: number;
  trimBefore: number;
  trimAfter: number | undefined;
};

export function getVideoClipDuration(asset: AssetSettings) {
  const end = asset.endSeconds ?? asset.sourceDurationSeconds;
  if (end === null || !Number.isFinite(end) || end <= asset.startSeconds) return null;
  return end - asset.startSeconds;
}

export function getVideoAssetTiming(asset: AssetSettings, blockDurationSeconds: number, fps: number): VideoAssetTiming {
  const clipDurationSeconds = getVideoClipDuration(asset);
  const blockDurationInFrames = Math.max(1, Math.ceil(blockDurationSeconds * fps));

  if (asset.shortageMode === "fit-duration" && clipDurationSeconds !== null) {
    const playbackRate = clipDurationSeconds / (blockDurationInFrames / fps);
    const trimBefore = Math.max(0, Math.round(asset.startSeconds * fps));
    return {
      clipDurationSeconds,
      clipDurationInFrames: blockDurationInFrames,
      playbackRate,
      trimBefore,
      trimAfter: trimBefore + blockDurationInFrames,
    };
  }

  const trimBefore = Math.max(0, Math.round(asset.startSeconds * fps));
  const clipDurationInFrames = clipDurationSeconds === null ? null : Math.max(1, Math.round(clipDurationSeconds * fps));
  return {
    clipDurationSeconds,
    clipDurationInFrames,
    playbackRate: 1,
    trimBefore,
    trimAfter: clipDurationInFrames === null ? undefined : trimBefore + clipDurationInFrames,
  };
}

export function isVideoPlaybackRateSupported(playbackRate: number) {
  return (
    Number.isFinite(playbackRate) &&
    playbackRate >= VIDEO_PLAYBACK_RATE_RANGE.min &&
    playbackRate <= VIDEO_PLAYBACK_RATE_RANGE.max
  );
}

export function getVideoPlaybackRateError(asset: AssetSettings, blockDurationSeconds: number, fps: number) {
  if (asset.shortageMode !== "fit-duration") return null;
  const timing = getVideoAssetTiming(asset, blockDurationSeconds, fps);
  if (timing.clipDurationSeconds === null) {
    return "元動画の長さが不明なため、再生速度を計算できません。";
  }
  if (isVideoPlaybackRateSupported(timing.playbackRate)) return null;
  return `必要な再生速度 ${timing.playbackRate.toFixed(2)}× は対応範囲外です（${VIDEO_PLAYBACK_RATE_RANGE.min}〜${VIDEO_PLAYBACK_RATE_RANGE.max}×）。クリップ区間またはブロック尺を調整してください。`;
}
