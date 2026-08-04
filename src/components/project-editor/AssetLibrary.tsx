"use client";

import { useState } from "react";
import type { AssetRow } from "./types";

type AssetScope = "shared" | "project";

type Props = {
  projectId: string;
  assets: AssetRow[];
  onChanged: (assets: AssetRow[]) => void;
};

export function AssetLibrary({ projectId, assets, onChanged }: Props) {
  const [uploadingScope, setUploadingScope] = useState<AssetScope | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropScope, setDropScope] = useState<AssetScope | null>(null);
  const [state, setState] = useState("");
  const scopedAssetsUrl = `/api/assets?projectId=${encodeURIComponent(projectId)}`;
  const sharedAssets = assets.filter((asset) => asset.projectId === null);
  const projectAssets = assets.filter((asset) => asset.projectId === projectId);

  const refreshAssets = async () => {
    const response = await fetch(scopedAssetsUrl);
    if (!response.ok) throw new Error("素材一覧を更新できませんでした");
    const next = (await response.json()) as AssetRow[];
    onChanged(next);
    return next;
  };

  const upload = async (file: File | undefined, scope: AssetScope) => {
    if (!file) return;
    setUploadingScope(scope);
    setState("");
    const form = new FormData();
    form.set("file", file);
    if (scope === "project") form.set("projectId", projectId);
    const response = await fetch("/api/assets", { method: "POST", body: form });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setState(body.error ?? "アップロードに失敗しました");
      setUploadingScope(null);
      return;
    }

    const refresh = async () => {
      try {
        const next = await refreshAssets();
        if (next.some((item) => item.status === "processing")) {
          window.setTimeout(() => void refresh(), 1200);
        } else {
          setUploadingScope(null);
        }
      } catch (error) {
        setState(error instanceof Error ? error.message : "素材一覧を更新できませんでした");
        setUploadingScope(null);
      }
    };
    await refresh();
  };

  const moveAsset = async (assetId: string, scope: AssetScope) => {
    const asset = assets.find((item) => item.id === assetId);
    const targetProjectId = scope === "project" ? projectId : null;
    if (!asset || asset.projectId === targetProjectId) return;

    setMovingId(assetId);
    setState("");
    const response = await fetch(`/api/assets/${assetId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: targetProjectId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState(body.error ?? "素材を移動できませんでした");
    } else {
      onChanged(assets.map((item) => (item.id === assetId ? (body as AssetRow) : item)));
    }
    setMovingId(null);
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

  const sections: Array<{ scope: AssetScope; title: string; description: string; rows: AssetRow[] }> = [
    {
      scope: "shared",
      title: "共通素材",
      description: "すべてのプロジェクトで利用できます",
      rows: sharedAssets,
    },
    {
      scope: "project",
      title: "このプロジェクトの素材",
      description: "このプロジェクト内だけで利用できます",
      rows: projectAssets,
    },
  ];

  return (
    <details className="panel">
      <summary>
        <span>素材ライブラリ</span>
        <small>{assets.length}件</small>
      </summary>
      <div className="asset-library">
        {state ? <p className="asset-library-state">{state}</p> : null}
        {sections.map(({ scope, title, description, rows }) => (
          <section
            className={`asset-scope ${dropScope === scope ? "drop-target" : ""}`}
            key={scope}
            onDragEnter={(event) => {
              event.preventDefault();
              setDropScope(scope);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropScope(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const assetId = event.dataTransfer.getData("application/x-diary-asset-id");
              setDropScope(null);
              setDraggingId(null);
              if (assetId) void moveAsset(assetId, scope);
            }}
          >
            <div className="asset-scope-heading">
              <div>
                <strong>{title}</strong>
                <small>
                  {description} ・ {rows.length}件
                </small>
              </div>
              <label className="secondary upload-button">
                {uploadingScope === scope ? "変換中…" : "＋ アップロード"}
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.psd"
                  disabled={uploadingScope !== null}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    void upload(input.files?.[0], scope).finally(() => {
                      input.value = "";
                    });
                  }}
                />
              </label>
            </div>
            {rows.length ? (
              <div className="asset-grid">
                {rows.map((asset) => (
                  <article
                    className={`asset-card ${asset.status} ${draggingId === asset.id ? "dragging" : ""}`}
                    draggable={movingId === null}
                    key={asset.id}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-diary-asset-id", asset.id);
                      event.dataTransfer.setData("text/plain", asset.id);
                      setDraggingId(asset.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropScope(null);
                    }}
                  >
                    <div className="asset-preview">
                      {asset.status === "ready" && asset.kind === "image" ? (
                        <img src={`/api/files/assets/${asset.id}`} alt={asset.originalName} loading="lazy" />
                      ) : asset.status === "ready" && asset.kind === "video" ? (
                        <video src={`/api/files/assets/${asset.id}`} controls preload="metadata" />
                      ) : asset.status === "ready" && asset.kind === "audio" ? (
                        <audio src={`/api/files/assets/${asset.id}`} controls preload="metadata" />
                      ) : (
                        <div className="asset-preview-placeholder">
                          <strong>
                            {asset.kind === "psd" ? "PSD" : asset.status === "processing" ? "変換中" : "!"}
                          </strong>
                          <small>{asset.kind === "psd" ? "立ち絵素材" : (asset.error ?? asset.status)}</small>
                        </div>
                      )}
                    </div>
                    <div className="asset-card-info">
                      <span className="asset-drag-handle" title="ドラッグしてライブラリ間を移動" aria-hidden="true">
                        ⋮⋮
                      </span>
                      <div>
                        <strong title={asset.originalName}>{asset.originalName}</strong>
                        <small>
                          {assetKindLabel(asset.kind)} ・{" "}
                          {movingId === asset.id ? "移動中…" : assetStatusLabel(asset.status)}
                        </small>
                      </div>
                      <button
                        className="icon danger"
                        title="素材を削除"
                        disabled={asset.status === "processing" || deletingId === asset.id || movingId === asset.id}
                        onClick={() => void removeAsset(asset)}
                      >
                        {deletingId === asset.id ? "…" : "×"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="asset-grid-empty">ここへ素材をドロップ、またはアップロード</div>
            )}
          </section>
        ))}
      </div>
    </details>
  );
}

const assetKindLabel = (kind: AssetRow["kind"]) => ({ image: "画像", video: "動画", audio: "音声", psd: "PSD" })[kind];
const assetStatusLabel = (status: string) =>
  ({ ready: "利用可能", processing: "変換中", error: "エラー" })[status] ?? status;
