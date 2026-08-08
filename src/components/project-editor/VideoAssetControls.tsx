"use client";

import type { AssetSettings } from "@/domain/types";
import { getVideoAssetTiming, getVideoClipDuration, getVideoPlaybackRateError } from "@/domain/video-asset";
import { AudioVolumeSlider } from "../AudioVolumeSlider";

type Props = {
  asset: AssetSettings;
  assetDefaultVolume: number;
  blockDurationSeconds: number;
  updateAsset: (recipe: (draft: AssetSettings) => void) => void;
};

const formatSeconds = (seconds: number) => `${seconds.toFixed(2)}秒`;

export function VideoAssetControls({ asset, assetDefaultVolume, blockDurationSeconds, updateAsset }: Props) {
  const clipDuration = getVideoClipDuration(asset);
  const timing = getVideoAssetTiming(asset, blockDurationSeconds, 30);
  const playbackRateError = getVideoPlaybackRateError(asset, blockDurationSeconds, 30);
  const effectiveEnd = asset.endSeconds ?? asset.sourceDurationSeconds;

  return (
    <div className="video-asset-controls">
      <div className="video-clip-fields">
        <label>
          クリップ開始
          <input
            type="number"
            min="0"
            max={effectiveEnd === null ? undefined : Math.max(0, effectiveEnd - 0.01)}
            step="0.1"
            value={asset.startSeconds}
            onChange={(event) => {
              const requested = Number(event.target.value);
              if (!Number.isFinite(requested)) return;
              updateAsset((draft) => {
                const end = draft.endSeconds ?? draft.sourceDurationSeconds;
                draft.startSeconds = Math.max(0, end === null ? requested : Math.min(requested, end - 0.01));
              });
            }}
          />
        </label>
        <label>
          クリップ終了
          <input
            type="number"
            min={asset.startSeconds + 0.01}
            max={asset.sourceDurationSeconds ?? undefined}
            step="0.1"
            placeholder={asset.sourceDurationSeconds === null ? "動画末尾" : formatSeconds(asset.sourceDurationSeconds)}
            value={asset.endSeconds ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              updateAsset((draft) => {
                if (value === "") {
                  draft.endSeconds = null;
                  return;
                }
                const requested = Number(value);
                if (!Number.isFinite(requested)) return;
                const maximum = draft.sourceDurationSeconds ?? requested;
                draft.endSeconds = Math.min(maximum, Math.max(draft.startSeconds + 0.01, requested));
              });
            }}
          />
        </label>
        <span className="video-clip-summary">
          {clipDuration === null ? "動画尺を取得できません" : `使用する長さ ${formatSeconds(clipDuration)}`}
        </span>
      </div>

      <label className="video-duration-mode">
        ブロック尺との合わせ方
        <select
          value={asset.shortageMode}
          onChange={(event) =>
            updateAsset((draft) => {
              draft.shortageMode = event.target.value as AssetSettings["shortageMode"];
            })
          }
        >
          <option value="loop">不足時：最初から繰り返す</option>
          <option value="freeze">不足時：最終フレームで停止</option>
          <option value="fade-out">不足時：終端でフェードアウト</option>
          <option value="fit-duration">常に：再生速度を変えて尺に合わせる</option>
        </select>
      </label>

      {asset.shortageMode === "fade-out" ? (
        <label>
          フェード時間
          <input
            type="number"
            min="0.1"
            step="0.1"
            placeholder="既定"
            value={asset.fadeOutSeconds ?? ""}
            onChange={(event) =>
              updateAsset((draft) => {
                draft.fadeOutSeconds = event.target.value === "" ? null : Math.max(0.1, Number(event.target.value));
              })
            }
          />
        </label>
      ) : null}

      <AudioVolumeSlider
        value={asset.volumeOverride}
        defaultValue={assetDefaultVolume}
        onChange={(volumeOverride) => updateAsset((draft) => void (draft.volumeOverride = volumeOverride))}
      />

      <small className={`video-duration-help ${playbackRateError ? "error" : ""}`}>
        {playbackRateError
          ? playbackRateError
          : asset.shortageMode === "fit-duration"
            ? `再生速度 ${timing.playbackRate.toFixed(2)}×（${formatSeconds(blockDurationSeconds)}に合わせます）`
            : "素材が長い場合はブロック末尾でカットされます。"}
      </small>
    </div>
  );
}
