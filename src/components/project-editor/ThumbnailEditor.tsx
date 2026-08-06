"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { createId } from "@/domain/id";
import { getThumbnailAnchorTransform } from "@/domain/thumbnail";
import type { Character, ProjectDocument, Thumbnail, ThumbnailEffect, ThumbnailElement } from "@/domain/types";
import { getAssetDurationSeconds } from "./asset-metadata";
import type { AssetRow, UpdateProject } from "./types";

type Props = { project: ProjectDocument; characters: Character[]; assets: AssetRow[]; update: UpdateProject };

const transformDefaults = { x: 960, y: 540, anchor: "center" as const, rotation: 0, scale: 1, effects: [] };
const THUMBNAIL_ELEMENT_DRAG_TYPE = "application/x-making-diary-thumbnail-element";

export function ThumbnailEditor({ project, characters, assets, update }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const visualAssets = assets.filter(
    (asset) => asset.status === "ready" && (asset.kind === "image" || asset.kind === "video"),
  );
  const moveElement = (fromIndex: number, toIndex: number) =>
    update((draft) => {
      const elements = draft.thumbnail.elements;
      const [moved] = elements.splice(fromIndex, 1);
      if (!moved) return;
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      elements.splice(Math.max(0, Math.min(adjustedIndex, elements.length)), 0, moved);
    });
  const swapElement = (index: number, nextIndex: number) =>
    update((draft) => {
      const elements = draft.thumbnail.elements;
      if (!elements[index] || !elements[nextIndex]) return;
      [elements[index], elements[nextIndex]] = [elements[nextIndex], elements[index]];
    });
  const addCharacter = () => {
    const character = characters.find((item) => project.characterIds.includes(item.id) && item.psdAssetId);
    if (!character) return;
    update((draft) =>
      draft.thumbnail.elements.push({
        id: createId(),
        type: "character",
        characterId: character.id,
        psdOverrides: {},
        ...transformDefaults,
      }),
    );
  };
  const addAsset = () => {
    if (!visualAssets[0]) return;
    update((draft) =>
      draft.thumbnail.elements.push({
        id: createId(),
        type: "asset",
        assetId: visualAssets[0].id,
        timeSeconds: 0,
        ...transformDefaults,
      }),
    );
  };
  const addText = () =>
    update((draft) =>
      draft.thumbnail.elements.push({
        id: createId(),
        type: "text",
        text: "テキスト",
        textAlign: "center",
        color: "#ffffff",
        fontSize: 120,
        ...transformDefaults,
        effects: [{ id: createId(), type: "outline", width: 8, color: "#000000" }],
      }),
    );
  const canAddCharacter = characters.some((item) => project.characterIds.includes(item.id) && item.psdAssetId);

  return (
    <section className="panel thumbnail-editor">
      <div className="thumbnail-editor-heading">
        <div>
          <strong>サムネイルエディタ</strong>
          <small>1920 × 1080</small>
        </div>
        <div className="thumbnail-add-actions">
          <AddMenu
            label="オブジェクトを追加"
            options={[
              { label: "立ち絵", disabled: !canAddCharacter, onSelect: addCharacter },
              { label: "素材", disabled: visualAssets.length === 0, onSelect: addAsset },
              { label: "文字", onSelect: addText },
            ]}
          />
        </div>
      </div>
      <div className="thumbnail-element-list">
        {project.thumbnail.elements.length === 0 ? (
          <p className="project-credit-id-empty">要素を追加してください。</p>
        ) : null}
        {project.thumbnail.elements.map((element, index) => (
          <ThumbnailElementEditor
            key={element.id}
            element={element}
            index={index}
            elementCount={project.thumbnail.elements.length}
            project={project}
            characters={characters}
            assets={visualAssets}
            update={update}
            dragging={draggingId === element.id}
            dropTarget={dropTargetId === element.id}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(THUMBNAIL_ELEMENT_DRAG_TYPE, String(index));
              setDraggingId(element.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes(THUMBNAIL_ELEMENT_DRAG_TYPE)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetId(element.id);
            }}
            onDrop={(event) => {
              const fromIndex = Number(event.dataTransfer.getData(THUMBNAIL_ELEMENT_DRAG_TYPE));
              if (!Number.isInteger(fromIndex)) return;
              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              moveElement(fromIndex, index + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0));
              setDraggingId(null);
              setDropTargetId(null);
            }}
            onMoveUp={() => swapElement(index, index - 1)}
            onMoveDown={() => swapElement(index, index + 1)}
          />
        ))}
      </div>
    </section>
  );
}

function ThumbnailElementEditor({
  element,
  index,
  elementCount,
  project,
  characters,
  assets,
  update,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
}: {
  element: ThumbnailElement;
  index: number;
  elementCount: number;
  project: ProjectDocument;
  characters: Character[];
  assets: AssetRow[];
  update: UpdateProject;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDetailsElement>) => void;
  onDrop: (event: DragEvent<HTMLDetailsElement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const change = (recipe: (draft: ThumbnailElement) => void) =>
    update((draft) => recipe(draft.thumbnail.elements[index]));
  const label = element.type === "text" ? "文字" : element.type === "character" ? "立ち絵" : "素材";
  return (
    <details
      className={`thumbnail-element ${dragging ? "dragging" : ""} ${dropTarget ? "drop-target" : ""}`}
      open
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <summary>
        <span
          className="drag-handle"
          role="button"
          aria-label={`${label}レイヤーを並べ替え`}
          title="ドラッグしてレイヤーを並べ替え"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={(event) => event.preventDefault()}
        >
          ⠿
        </span>
        <strong>
          {index + 1}. {label}
        </strong>
        <small>{index === 0 ? "最背面" : index === elementCount - 1 ? "最前面" : ""}</small>
        <div className="block-move-buttons" role="group" aria-label={`${label}レイヤーの並べ替え`}>
          <button
            type="button"
            className="icon block-move-button"
            title="ひとつ上へ移動"
            aria-label="ひとつ上へ移動"
            disabled={index === 0}
            onClick={(event) => {
              event.preventDefault();
              onMoveUp();
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon block-move-button"
            title="ひとつ下へ移動"
            aria-label="ひとつ下へ移動"
            disabled={index === elementCount - 1}
            onClick={(event) => {
              event.preventDefault();
              onMoveDown();
            }}
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          className="icon danger thumbnail-element-delete"
          title={`${label}レイヤーを削除`}
          aria-label={`${label}レイヤーを削除`}
          onClick={(event) => {
            event.preventDefault();
            update((draft) => draft.thumbnail.elements.splice(index, 1));
          }}
        >
          ×
        </button>
      </summary>
      <div className="thumbnail-element-body">
        {element.type === "character" ? (
          <CharacterFields element={element} project={project} characters={characters} change={change} />
        ) : null}
        {element.type === "asset" ? <AssetFields element={element} assets={assets} change={change} /> : null}
        {element.type === "text" ? <TextFields element={element} change={change} /> : null}
        <TransformFields element={element} change={change} />
        <EffectFields element={element} change={change} />
      </div>
    </details>
  );
}

function AssetFields({
  element,
  assets,
  change,
}: {
  element: Extract<ThumbnailElement, { type: "asset" }>;
  assets: AssetRow[];
  change: (recipe: (draft: ThumbnailElement) => void) => void;
}) {
  const asset = assets.find((item) => item.id === element.assetId);
  const duration = asset?.kind === "video" ? getAssetDurationSeconds(asset) : null;
  return (
    <>
      <label className="wide">
        素材
        <select
          value={element.assetId}
          onChange={(event) =>
            change((draft) => {
              if (draft.type !== "asset") return;
              draft.assetId = event.target.value;
              draft.timeSeconds = 0;
            })
          }
        >
          {assets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.projectId ? "プロジェクト" : "共通"}｜{item.originalName}
            </option>
          ))}
        </select>
      </label>
      {asset?.kind === "video" ? (
        <label>
          使用する秒数
          <input
            type="number"
            min="0"
            max={duration ?? undefined}
            step="0.1"
            value={element.timeSeconds}
            onChange={(event) =>
              change((draft) => {
                if (draft.type === "asset") draft.timeSeconds = Math.max(0, Number(event.target.value));
              })
            }
          />
          {duration !== null ? <small>動画尺: {duration.toFixed(2)}秒</small> : null}
        </label>
      ) : null}
    </>
  );
}

function CharacterFields({
  element,
  project,
  characters,
  change,
}: {
  element: Extract<ThumbnailElement, { type: "character" }>;
  project: ProjectDocument;
  characters: Character[];
  change: (recipe: (draft: ThumbnailElement) => void) => void;
}) {
  const available = characters.filter(
    (character) => project.characterIds.includes(character.id) && character.psdAssetId,
  );
  const character = characters.find((item) => item.id === element.characterId);
  const filterNames = character
    ? (character.psdFilterOrder.length ? character.psdFilterOrder : Object.keys(character.psdFilters)).filter(
        (name) => character.psdFilters[name],
      )
    : [];
  return (
    <>
      <label className="wide">
        キャラクター
        <select
          value={element.characterId}
          onChange={(event) =>
            change((draft) => {
              if (draft.type === "character") {
                draft.characterId = event.target.value;
                draft.psdOverrides = {};
              }
            })
          }
        >
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {character &&
        filterNames.map((name) => (
          <label key={name}>
            {name}
            <select
              value={element.psdOverrides[name] ?? ""}
              onChange={(event) =>
                change((draft) => {
                  if (draft.type !== "character") return;
                  if (event.target.value) draft.psdOverrides[name] = event.target.value;
                  else delete draft.psdOverrides[name];
                })
              }
            >
              <option value="">既定: {character.psdDefaults[name] ?? "未指定"}</option>
              {(character.psdFilters[name].choiceOrder.length
                ? character.psdFilters[name].choiceOrder
                : Object.keys(character.psdFilters[name].choices)
              ).map((choice) => (
                <option key={choice}>{choice}</option>
              ))}
            </select>
          </label>
        ))}
    </>
  );
}

function TextFields({
  element,
  change,
}: {
  element: Extract<ThumbnailElement, { type: "text" }>;
  change: (recipe: (draft: ThumbnailElement) => void) => void;
}) {
  return (
    <>
      <label className="wide">
        文字
        <textarea
          value={element.text}
          onChange={(event) =>
            change((draft) => {
              if (draft.type === "text") draft.text = event.target.value;
            })
          }
        />
      </label>
      <label>
        文字色
        <input
          type="color"
          value={element.color}
          onChange={(event) =>
            change((draft) => {
              if (draft.type === "text") draft.color = event.target.value;
            })
          }
        />
      </label>
      <label>
        文字サイズ
        <input
          type="number"
          min="1"
          value={element.fontSize}
          onChange={(event) =>
            change((draft) => {
              if (draft.type === "text") draft.fontSize = Number(event.target.value);
            })
          }
        />
      </label>
      <label>
        文字揃え
        <select
          value={element.textAlign}
          onChange={(event) =>
            change((draft) => {
              if (draft.type === "text") draft.textAlign = event.target.value as "left" | "center" | "right";
            })
          }
        >
          <option value="left">左揃え</option>
          <option value="center">中央揃え</option>
          <option value="right">右揃え</option>
        </select>
      </label>
    </>
  );
}

function TransformFields({
  element,
  change,
}: {
  element: ThumbnailElement;
  change: (recipe: (draft: ThumbnailElement) => void) => void;
}) {
  const numberField = (key: "x" | "y" | "rotation" | "scale", value: number) =>
    change((draft) => {
      draft[key] = value;
    });
  return (
    <div className="thumbnail-transform wide">
      <label>
        基準位置
        <select
          value={element.anchor}
          onChange={(event) =>
            change((draft) => {
              draft.anchor = event.target.value as ThumbnailElement["anchor"];
            })
          }
        >
          <option value="top-left">左上</option>
          <option value="top-center">上中央</option>
          <option value="top-right">右上</option>
          <option value="center-left">左中央</option>
          <option value="center">中央</option>
          <option value="center-right">右中央</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-center">下中央</option>
          <option value="bottom-right">右下</option>
        </select>
      </label>
      <label>
        X<input type="number" value={element.x} onChange={(event) => numberField("x", Number(event.target.value))} />
      </label>
      <label>
        Y<input type="number" value={element.y} onChange={(event) => numberField("y", Number(event.target.value))} />
      </label>
      <label>
        回転（度）
        <input
          type="number"
          value={element.rotation}
          onChange={(event) => numberField("rotation", Number(event.target.value))}
        />
      </label>
      <label>
        拡大率
        <input
          type="number"
          min="0.01"
          step="0.1"
          value={element.scale}
          onChange={(event) => numberField("scale", Number(event.target.value))}
        />
      </label>
    </div>
  );
}

function EffectFields({
  element,
  change,
}: {
  element: ThumbnailElement;
  change: (recipe: (draft: ThumbnailElement) => void) => void;
}) {
  const addEffect = (type: ThumbnailEffect["type"]) =>
    change((draft) => {
      const common = { id: createId() };
      if (type === "background") draft.effects.push({ ...common, type, color: "#ffffff", padding: 24 });
      if (type === "outline") draft.effects.push({ ...common, type, color: "#000000", width: 8 });
      if (type === "shadow") draft.effects.push({ ...common, type, color: "#000000", x: 16, y: 16, blur: 12 });
      if (type === "border-radius") draft.effects.push({ ...common, type, radius: 24 });
    });
  const updateEffect = (index: number, recipe: (effect: ThumbnailEffect) => void) =>
    change((draft) => recipe(draft.effects[index]));
  const swap = (index: number, nextIndex: number) =>
    change((draft) => {
      if (!draft.effects[index] || !draft.effects[nextIndex]) return;
      [draft.effects[index], draft.effects[nextIndex]] = [draft.effects[nextIndex], draft.effects[index]];
    });
  return (
    <div className="thumbnail-effects wide">
      <div className="thumbnail-effects-heading">
        <span>
          <strong>エフェクト</strong>
          <small>上から順に適用</small>
        </span>
        <div>
          <AddMenu
            label="エフェクトを追加"
            options={[
              { label: "影", onSelect: () => addEffect("shadow") },
              { label: "縁取り", onSelect: () => addEffect("outline") },
              { label: "背景", onSelect: () => addEffect("background") },
              { label: "角丸", onSelect: () => addEffect("border-radius") },
            ]}
          />
        </div>
      </div>
      {element.effects.map((effect, index) => (
        <div className="thumbnail-effect-row" key={effect.id}>
          <strong>
            {effect.type === "background"
              ? "背景"
              : effect.type === "outline"
                ? "縁取り"
                : effect.type === "shadow"
                  ? "影"
                  : "角丸"}
          </strong>
          {effect.type !== "border-radius" ? (
            <label>
              色
              <input
                type="color"
                value={effect.color}
                onChange={(event) =>
                  updateEffect(index, (draft) => {
                    if (draft.type !== "border-radius") draft.color = event.target.value;
                  })
                }
              />
            </label>
          ) : null}
          {effect.type === "background" ? (
            <label>
              余白
              <input
                type="number"
                min="0"
                value={effect.padding}
                onChange={(event) =>
                  updateEffect(index, (draft) => {
                    if (draft.type === "background") draft.padding = Math.max(0, Number(event.target.value));
                  })
                }
              />
            </label>
          ) : null}
          {effect.type === "outline" ? (
            <label>
              太さ
              <input
                type="number"
                min="0"
                value={effect.width}
                onChange={(event) =>
                  updateEffect(index, (draft) => {
                    if (draft.type === "outline") draft.width = Math.max(0, Number(event.target.value));
                  })
                }
              />
            </label>
          ) : null}
          {effect.type === "shadow" ? (
            <>
              <label>
                X
                <input
                  type="number"
                  value={effect.x}
                  onChange={(event) =>
                    updateEffect(index, (draft) => {
                      if (draft.type === "shadow") draft.x = Number(event.target.value);
                    })
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={effect.y}
                  onChange={(event) =>
                    updateEffect(index, (draft) => {
                      if (draft.type === "shadow") draft.y = Number(event.target.value);
                    })
                  }
                />
              </label>
              <label>
                ぼかし
                <input
                  type="number"
                  min="0"
                  value={effect.blur}
                  onChange={(event) =>
                    updateEffect(index, (draft) => {
                      if (draft.type === "shadow") draft.blur = Math.max(0, Number(event.target.value));
                    })
                  }
                />
              </label>
            </>
          ) : null}
          {effect.type === "border-radius" ? (
            <label>
              半径
              <input
                type="number"
                min="0"
                value={effect.radius}
                onChange={(event) =>
                  updateEffect(index, (draft) => {
                    if (draft.type === "border-radius") draft.radius = Math.max(0, Number(event.target.value));
                  })
                }
              />
            </label>
          ) : null}
          <div className="block-move-buttons">
            <button
              className="icon block-move-button"
              type="button"
              disabled={index === 0}
              onClick={() => swap(index, index - 1)}
            >
              ↑
            </button>
            <button
              className="icon block-move-button"
              type="button"
              disabled={index === element.effects.length - 1}
              onClick={() => swap(index, index + 1)}
            >
              ↓
            </button>
          </div>
          <button
            className="icon danger"
            type="button"
            title="エフェクトを削除"
            aria-label="エフェクトを削除"
            onClick={() => change((draft) => draft.effects.splice(index, 1))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function AddMenu({
  label,
  options,
}: {
  label: string;
  options: Array<{ label: string; disabled?: boolean; onSelect: () => void }>;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);
  return (
    <details className="thumbnail-add-menu" ref={detailsRef}>
      <summary className="secondary" aria-label={label} title={label}>
        ＋ 追加
      </summary>
      <div className="thumbnail-add-menu-popover">
        {options.map((option) => (
          <button
            type="button"
            key={option.label}
            disabled={option.disabled}
            onClick={(event) => {
              option.onSelect();
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function ThumbnailPreview({
  thumbnail,
  characters,
  assets,
}: {
  thumbnail: Thumbnail;
  characters: Character[];
  assets: AssetRow[];
}) {
  const avatarUrls = useThumbnailAvatarUrls(thumbnail, characters);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const stageRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateScale = () => setPreviewScale(stage.clientWidth / 1920);
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="thumbnail-preview-shell">
      <div className="thumbnail-preview-stage" ref={stageRef}>
        {thumbnail.elements.map((element) => {
          const style = {
            left: `${element.x / 19.2}%`,
            top: `${element.y / 10.8}%`,
            ...getThumbnailAnchorTransform(element.anchor),
            transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
          };
          let content: ReactNode = null;
          if (element.type === "character") {
            content = avatarUrls[element.id] ? (
              <img className="thumbnail-character" src={avatarUrls[element.id]} alt="" />
            ) : null;
          } else if (element.type === "asset") {
            const asset = assetsById.get(element.assetId);
            if (!asset) return null;
            content =
              asset.kind === "video" ? (
                <ThumbnailVideoFrame src={`/api/files/assets/${asset.id}`} timeSeconds={element.timeSeconds} />
              ) : (
                <img className="thumbnail-media" src={`/api/files/assets/${asset.id}`} alt="" />
              );
          } else {
            content = (
              <div
                className="thumbnail-text"
                style={{
                  fontSize: `${element.fontSize / 19.2}cqw`,
                  color: element.color,
                  textAlign: element.textAlign,
                }}
              >
                <span>{element.text}</span>
              </div>
            );
          }
          return (
            <div className="thumbnail-preview-element" key={element.id} style={style}>
              <ThumbnailEffectStack effects={element.effects} previewScale={previewScale} filterPrefix={element.id}>
                {content}
              </ThumbnailEffectStack>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThumbnailEffectStack({
  effects,
  children,
  previewScale,
  filterPrefix,
}: {
  effects: ThumbnailEffect[];
  children: ReactNode;
  previewScale: number;
  filterPrefix: string;
}) {
  return effects.reduce<ReactNode>((result, effect, index) => {
    let style: CSSProperties = {};
    if (effect.type === "background") style = { backgroundColor: effect.color, padding: `${effect.padding / 19.2}cqw` };
    if (effect.type === "border-radius") style = { borderRadius: `${effect.radius / 19.2}cqw`, overflow: "hidden" };
    if (effect.type === "shadow")
      style = {
        filter: `drop-shadow(${effect.x / 19.2}cqw ${effect.y / 19.2}cqw ${effect.blur / 19.2}cqw ${effect.color})`,
      };
    if (effect.type === "outline") {
      const filterId = `thumbnail-outline-${filterPrefix}-${effect.id}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-");
      return (
        <span className="thumbnail-effect-layer thumbnail-effect-outline">
          <svg className="thumbnail-effect-filter-defs" aria-hidden="true">
            <defs>
              <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
                <feMorphology
                  in="SourceAlpha"
                  operator="dilate"
                  radius={effect.width * previewScale * 0.5}
                  result="expanded"
                />
                <feFlood floodColor={effect.color} result="color" />
                <feComposite in="color" in2="expanded" operator="in" result="outline" />
                <feMerge>
                  <feMergeNode in="outline" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>
          <span className="thumbnail-effect-layer" style={{ filter: `url(#${filterId})` }}>
            {result}
          </span>
        </span>
      );
    }
    return (
      <span className={`thumbnail-effect-layer thumbnail-effect-${effect.type}`} style={style}>
        {result}
      </span>
    );
  }, children);
}

function ThumbnailVideoFrame({ src, timeSeconds }: { src: string; timeSeconds: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seek = () => {
    const video = videoRef.current;
    if (!video) return;
    const maximum = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.01) : timeSeconds;
    video.currentTime = Math.min(timeSeconds, maximum);
  };
  useEffect(seek, [src, timeSeconds]);
  return (
    <video
      ref={videoRef}
      className="thumbnail-media"
      src={src}
      preload="metadata"
      muted
      playsInline
      onLoadedMetadata={seek}
    />
  );
}

function useThumbnailAvatarUrls(thumbnail: Thumbnail, characters: Character[]) {
  const specs = useMemo(
    () =>
      thumbnail.elements
        .filter((element): element is Extract<ThumbnailElement, { type: "character" }> => element.type === "character")
        .map((element) => {
          const character = characters.find((item) => item.id === element.characterId);
          return character?.psdAssetId
            ? {
                id: element.id,
                assetId: character.psdAssetId,
                filters: character.psdFilters,
                selections: { ...character.psdDefaults, ...element.psdOverrides },
                fallback: character.avatar.previewUrl,
              }
            : null;
        })
        .filter(Boolean) as Array<{
        id: string;
        assetId: string;
        filters: Character["psdFilters"];
        selections: Record<string, string>;
        fallback: string | null;
      }>,
    [thumbnail, characters],
  );
  const signature = JSON.stringify(specs.map(({ id, assetId, selections }) => ({ id, assetId, selections })));
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    setUrls(Object.fromEntries(specs.filter((spec) => spec.fallback).map((spec) => [spec.id, spec.fallback!])));
    const timer = window.setTimeout(() => {
      void Promise.all(
        specs.map(async (spec) => {
          const response = await fetch(`/api/psd/${spec.assetId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ filters: spec.filters, selections: spec.selections }),
            signal: controller.signal,
          });
          const body = await response.json();
          return [spec.id, response.ok ? body.url : spec.fallback] as const;
        }),
      ).then((entries) => {
        if (!controller.signal.aborted) setUrls(Object.fromEntries(entries.filter((entry) => entry[1])));
      });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [signature]);
  return urls;
}
