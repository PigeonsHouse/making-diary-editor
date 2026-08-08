"use client";

import type { AudioClip, AudioOverride, ProjectAudioSettings } from "@/domain/types";
import { AudioVolumeSlider } from "../AudioVolumeSlider";
import type { AssetRow } from "./types";

const assetUrl = (assetId: string) => `/api/files/assets/${assetId}`;

const readyAudioAssets = (assets: AssetRow[]) =>
  assets.filter((asset) => asset.kind === "audio" && asset.status === "ready");

export function ProjectAudioSettingsEditor({
  settings,
  assets,
  onChange,
}: {
  settings: ProjectAudioSettings;
  assets: AssetRow[];
  onChange: (recipe: (draft: ProjectAudioSettings) => void) => void;
}) {
  return (
    <details className="panel">
      <summary>
        <span>BGM・SE</span>
        <small>プロジェクト既定</small>
      </summary>
      <div className="project-audio-settings">
        <AudioClipEditor
          label="BGM"
          value={settings.bgm}
          assets={assets}
          emptyLabel="BGMなし"
          onChange={(clip) => onChange((draft) => void (draft.bgm = clip))}
        />
        <AudioClipEditor
          label="シーン冒頭SE"
          value={settings.sceneIntroSe}
          assets={assets}
          emptyLabel="既定SEなし"
          onChange={(clip) => onChange((draft) => void (draft.sceneIntroSe = clip))}
        />
        <AudioClipEditor
          label="コンテンツ開始SE"
          value={settings.contentSe}
          assets={assets}
          emptyLabel="既定SEなし"
          onChange={(clip) => onChange((draft) => void (draft.contentSe = clip))}
        />
      </div>
    </details>
  );
}

function AudioClipEditor({
  label,
  value,
  assets,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: AudioClip | null;
  assets: AssetRow[];
  emptyLabel: string;
  onChange: (clip: AudioClip | null) => void;
}) {
  const audioAssets = readyAudioAssets(assets);
  return (
    <div className="audio-setting-row">
      <label>
        <span>{label}</span>
        <select
          value={value?.assetId ?? ""}
          onChange={(event) => {
            const asset = audioAssets.find((item) => item.id === event.target.value);
            onChange(asset ? { assetId: asset.id, url: assetUrl(asset.id), volumeOverride: null } : null);
          }}
        >
          <option value="">{emptyLabel}</option>
          {audioAssets.map((asset) => (
            <option value={asset.id} key={asset.id}>
              {asset.originalName}
            </option>
          ))}
        </select>
      </label>
      {value ? (
        <AudioVolumeSlider
          value={value.volumeOverride}
          defaultValue={assets.find((asset) => asset.id === value.assetId)?.defaultVolume ?? 1}
          onChange={(volumeOverride) => onChange({ ...value, volumeOverride })}
        />
      ) : null}
    </div>
  );
}

export function AudioOverrideEditor({
  label,
  value,
  projectDefault,
  assets,
  noneLabel,
  onChange,
}: {
  label: string;
  value: AudioOverride;
  projectDefault: AudioClip | null;
  assets: AssetRow[];
  noneLabel: string;
  onChange: (value: AudioOverride) => void;
}) {
  const audioAssets = readyAudioAssets(assets);
  const selectedValue = value.mode === "custom" ? value.clip.assetId : value.mode;
  const defaultAsset = projectDefault ? assets.find((asset) => asset.id === projectDefault.assetId) : null;

  return (
    <div className="audio-setting-row audio-override-row">
      <label>
        <span>{label}</span>
        <select
          value={selectedValue}
          onChange={(event) => {
            if (event.target.value === "inherit") return onChange({ mode: "inherit" });
            if (event.target.value === "none") return onChange({ mode: "none" });
            const asset = audioAssets.find((item) => item.id === event.target.value);
            if (asset) {
              onChange({ mode: "custom", clip: { assetId: asset.id, url: assetUrl(asset.id), volumeOverride: null } });
            }
          }}
        >
          <option value="inherit">プロジェクト設定を使用（{defaultAsset?.originalName ?? "なし"}）</option>
          <option value="none">{noneLabel}</option>
          {audioAssets.map((asset) => (
            <option value={asset.id} key={asset.id}>
              個別: {asset.originalName}
            </option>
          ))}
        </select>
      </label>
      {value.mode === "custom" ? (
        <AudioVolumeSlider
          value={value.clip.volumeOverride}
          defaultValue={assets.find((asset) => asset.id === value.clip.assetId)?.defaultVolume ?? 1}
          onChange={(volumeOverride) => onChange({ mode: "custom", clip: { ...value.clip, volumeOverride } })}
        />
      ) : null}
    </div>
  );
}
