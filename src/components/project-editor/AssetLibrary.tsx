"use client";

import { useState } from "react";
import type { AssetRow } from "./types";

export function AssetLibrary({ assets, onChanged }: { assets: AssetRow[]; onChanged: (assets: AssetRow[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [state, setState] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/assets", { method: "POST", body: form });
    if (response.ok) {
      const refresh = async () => {
        const next: AssetRow[] = await fetch("/api/assets").then((item) => item.json());
        onChanged(next);
        if (next.some((item) => item.status === "processing")) setTimeout(refresh, 1200);
        else setUploading(false);
      };
      await refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      setState(body.error ?? "アップロードに失敗しました");
      setUploading(false);
    }
  };

  const removeAsset = async (asset: AssetRow) => {
    if (!window.confirm(`「${asset.originalName}」を削除します。元に戻せません。続行しますか？`)) return;
    setDeletingId(asset.id);
    setState("");
    const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setState(body.error ?? "素材を削除できませんでした");
    else onChanged(assets.filter((item) => item.id !== asset.id));
    setDeletingId(null);
  };

  return (
    <details className="panel">
      <summary>
        <span>素材</span>
        <small>{assets.length}件</small>
      </summary>
      <div className="asset-library">
        <div className="asset-library-toolbar">
          <label className="secondary upload-button">
            {uploading ? "変換中…" : "＋ 画像・動画をアップロード"}
            <input
              type="file"
              accept="image/*,video/*,.psd"
              disabled={uploading}
              onChange={(event) => void upload(event.target.files?.[0])}
            />
          </label>
          {state ? <span className="asset-library-state">{state}</span> : null}
        </div>
        <div className="asset-grid">
          {assets.map((asset) => (
            <article className={`asset-card ${asset.status}`} key={asset.id}>
              <div className="asset-preview">
                {asset.status === "ready" && asset.kind === "image" ? (
                  <img src={`/api/files/assets/${asset.id}`} alt={asset.originalName} loading="lazy" />
                ) : asset.status === "ready" && asset.kind === "video" ? (
                  <video src={`/api/files/assets/${asset.id}`} controls preload="metadata" />
                ) : (
                  <div className="asset-preview-placeholder">
                    <strong>{asset.kind === "psd" ? "PSD" : asset.status === "processing" ? "変換中" : "!"}</strong>
                    <small>{asset.kind === "psd" ? "立ち絵素材" : (asset.error ?? asset.status)}</small>
                  </div>
                )}
              </div>
              <div className="asset-card-info">
                <div>
                  <strong title={asset.originalName}>{asset.originalName}</strong>
                  <small>
                    {assetKindLabel(asset.kind)} · {assetStatusLabel(asset.status)}
                  </small>
                </div>
                <button
                  className="icon danger"
                  title="素材を削除"
                  disabled={asset.status === "processing" || deletingId === asset.id}
                  onClick={() => void removeAsset(asset)}
                >
                  {deletingId === asset.id ? "…" : "×"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}

const assetKindLabel = (kind: AssetRow["kind"]) => ({ image: "画像", video: "動画", psd: "PSD" })[kind];
const assetStatusLabel = (status: string) =>
  ({ ready: "利用可能", processing: "変換中", error: "エラー" })[status] ?? status;
