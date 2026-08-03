"use client";

import type { AudioClip, AudioOverride, ProjectAudioSettings } from "@/domain/types";
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
            onChange(asset ? { assetId: asset.id, url: assetUrl(asset.id), volume: 1 } : null);
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
      {value ? <VolumeControl value={value.volume} onChange={(volume) => onChange({ ...value, volume })} /> : null}
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
              onChange({ mode: "custom", clip: { assetId: asset.id, url: assetUrl(asset.id), volume: 1 } });
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
        <VolumeControl
          value={value.clip.volume}
          onChange={(volume) => onChange({ mode: "custom", clip: { ...value.clip, volume } })}
        />
      ) : null}
    </div>
  );
}

function VolumeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="audio-volume">
      <span>音量 {Math.round(value * 100)}%</span>
      <input
        type="range"
        min="0"
        max="2"
        step="0.05"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
