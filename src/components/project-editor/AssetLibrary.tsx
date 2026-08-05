"use client";

import { useEffect, useRef, useState } from "react";
import type { AssetRow } from "./types";

type AssetScope = "shared" | "project";

type Props = {
  projectId: string;
  assets: AssetRow[];
  onChanged: (assets: AssetRow[]) => void;
};

const assetNameCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
const sortAssetsByName = (rows: AssetRow[]) =>
  [...rows].sort((left, right) => assetNameCollator.compare(left.originalName, right.originalName));

export function AssetLibrary({ projectId, assets, onChanged }: Props) {
  const [uploadingScope, setUploadingScope] = useState<AssetScope | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropScope, setDropScope] = useState<AssetScope | null>(null);
  const [expandedScopes, setExpandedScopes] = useState<Record<AssetScope, boolean>>({
    shared: false,
    project: false,
  });
  const [previewAsset, setPreviewAsset] = useState<AssetRow | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [state, setState] = useState("");
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const scopedAssetsUrl = `/api/assets?projectId=${encodeURIComponent(projectId)}`;
  const sharedAssets = sortAssetsByName(assets.filter((asset) => asset.projectId === null));
  const projectAssets = sortAssetsByName(assets.filter((asset) => asset.projectId === projectId));

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

  const renameAsset = async (asset: AssetRow) => {
    const requestedName = window.prompt("新しい素材名を入力してください", asset.originalName);
    if (requestedName === null) return;
    const originalName = requestedName.trim();
    if (!originalName) {
      setState("素材名を入力してください");
      return;
    }
    if (originalName === asset.originalName) return;

    setRenamingId(asset.id);
    setState("");
    const response = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ originalName }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState(body.error ?? "素材名を変更できませんでした");
    } else {
      onChanged(assets.map((item) => (item.id === asset.id ? (body as AssetRow) : item)));
    }
    setRenamingId(null);
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

  const toggleAudioPreview = async (asset: AssetRow) => {
    const player = audioPreviewRef.current;
    if (!player) return;
    if (playingAudioId === asset.id && !player.paused) {
      player.pause();
      return;
    }

    player.pause();
    player.src = `/api/files/assets/${asset.id}`;
    player.load();
    try {
      await player.play();
      setPlayingAudioId(asset.id);
    } catch {
      setPlayingAudioId(null);
      setState("音声を再生できませんでした");
    }
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
    <section className="panel asset-library-panel">
      <div className="asset-library-heading">
        <span>素材ライブラリ</span>
        <small>{assets.length}件</small>
      </div>
      <div className="asset-library">
        {state ? <p className="asset-library-state">{state}</p> : null}
        {sections.map(({ scope, title, description, rows }) => {
          const isExpanded = expandedScopes[scope];
          return (
            <section
              className={`asset-scope ${isExpanded ? "expanded" : "collapsed"} ${dropScope === scope ? "drop-target" : ""}`}
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
                <button
                  type="button"
                  className="asset-scope-toggle"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedScopes((current) => ({
                      ...current,
                      [scope]: !current[scope],
                    }))
                  }
                >
                  <span className="asset-scope-chevron" aria-hidden="true">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                  <span className="asset-scope-copy">
                    <strong>{title}</strong>
                    <small>
                      {description} ・ {rows.length}件
                    </small>
                  </span>
                </button>
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
              {isExpanded &&
                (rows.length ? (
                  <div className="asset-grid">
                    {rows.map((asset) => {
                      const isBusy = deletingId === asset.id || renamingId === asset.id || movingId === asset.id;
                      return (
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
                            {asset.status === "ready" && (asset.kind === "image" || asset.kind === "video") ? (
                              <button
                                type="button"
                                className="asset-thumbnail-button"
                                aria-label={`${asset.originalName}を大きく表示`}
                                title="大きく表示"
                                draggable={false}
                                onClick={() => setPreviewAsset(asset)}
                                onDragStart={(event) => event.preventDefault()}
                              >
                                {asset.kind === "image" ? (
                                  <img src={`/api/files/assets/${asset.id}`} alt="" loading="lazy" draggable={false} />
                                ) : (
                                  <video src={`/api/files/assets/${asset.id}`} muted playsInline preload="metadata" />
                                )}
                                <span className="asset-preview-open-label">拡大</span>
                              </button>
                            ) : asset.status === "ready" && asset.kind === "audio" ? (
                              <button
                                type="button"
                                className="asset-audio-preview"
                                aria-label={`${asset.originalName}を${playingAudioId === asset.id ? "停止" : "再生"}`}
                                draggable={false}
                                onClick={() => void toggleAudioPreview(asset)}
                                onDragStart={(event) => event.preventDefault()}
                              >
                                <span aria-hidden="true">{playingAudioId === asset.id ? "■" : "▶"}</span>
                                {playingAudioId === asset.id ? "停止" : "再生"}
                              </button>
                            ) : (
                              <div className="asset-preview-placeholder">
                                <strong>
                                  {asset.kind === "psd" ? "PSD" : asset.status === "processing" ? "変換中" : "!"}
                                </strong>
                                <small title={asset.error ?? undefined}>
                                  {asset.kind === "psd" ? "立ち絵素材" : (asset.error ?? asset.status)}
                                </small>
                              </div>
                            )}
                          </div>
                          <div className="asset-card-info">
                            <span
                              className="asset-drag-handle"
                              title="ドラッグしてライブラリ間を移動"
                              aria-hidden="true"
                            >
                              ⠿
                            </span>
                            <div className="asset-card-text">
                              <strong title={asset.originalName}>{asset.originalName}</strong>
                              <div className="asset-card-details">
                                <span>
                                  {assetKindLabel(asset.kind)} ・{" "}
                                  {movingId === asset.id ? "移動中…" : assetStatusLabel(asset.status)}
                                </span>
                                {asset.error ? (
                                  <span className="asset-error-detail" title={asset.error}>
                                    {asset.error}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="asset-card-actions">
                            <button
                              type="button"
                              className="asset-card-action"
                              disabled={isBusy}
                              onClick={() => void renameAsset(asset)}
                            >
                              {renamingId === asset.id ? "変更中…" : "名称変更"}
                            </button>
                            <button
                              type="button"
                              className="asset-card-action danger"
                              disabled={asset.status === "processing" || isBusy}
                              onClick={() => void removeAsset(asset)}
                            >
                              {deletingId === asset.id ? "削除中…" : "削除"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="asset-grid-empty">ここへ素材をドロップ、またはアップロード</div>
                ))}
            </section>
          );
        })}
        <audio
          className="asset-audio-player"
          ref={audioPreviewRef}
          preload="none"
          onEnded={() => setPlayingAudioId(null)}
          onPause={() => setPlayingAudioId(null)}
        />
      </div>
      {previewAsset ? <AssetPreviewDialog asset={previewAsset} onClose={() => setPreviewAsset(null)} /> : null}
    </section>
  );
}

function AssetPreviewDialog({ asset, onClose }: { asset: AssetRow; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      className="asset-lightbox"
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const clickedBackdrop =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (clickedBackdrop) event.currentTarget.close();
      }}
    >
      <div className="asset-lightbox-content">
        <header>
          <strong>{asset.originalName}</strong>
          <button type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
            閉じる
          </button>
        </header>
        <div className="asset-lightbox-media">
          {asset.kind === "image" ? (
            <img src={`/api/files/assets/${asset.id}`} alt={asset.originalName} />
          ) : (
            <video src={`/api/files/assets/${asset.id}`} controls playsInline preload="metadata" />
          )}
        </div>
      </div>
    </dialog>
  );
}

const assetKindLabel = (kind: AssetRow["kind"]) => ({ image: "画像", video: "動画", audio: "音声", psd: "PSD" })[kind];
const assetStatusLabel = (status: string) =>
  ({ ready: "利用可能", processing: "変換中", error: "エラー" })[status] ?? status;
