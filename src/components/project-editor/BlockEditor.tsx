"use client";

import { createDialogue } from "@/domain/defaults";
import { calculateBlock } from "@/domain/timeline";
import type { Character, ContentBlock } from "@/domain/types";
import { DialogueEditor } from "./DialogueEditor";
import { VideoAssetControls } from "./VideoAssetControls";
import { getAssetDurationSeconds } from "./asset-metadata";
import { BLOCK_DRAG_TYPE, hasBlockDragData, readBlockDragData } from "./block-dnd";
import { hasDialogueDragData, readDialogueDragData } from "./dialogue-dnd";
import type { AssetRow } from "./types";

type Props = {
  block: ContentBlock;
  diaryId: string;
  blockIndex: number;
  characters: Character[];
  projectCharacterIds: string[];
  assets: AssetRow[];
  updateBlock: (recipe: (draft: ContentBlock) => void) => void;
  remove: () => void;
  moveBlock: (fromBlockIndex: number, toBlockIndex: number) => void;
  moveDialogue: (
    diaryId: string,
    fromBlockIndex: number,
    fromDialogueIndex: number,
    toBlockIndex: number,
    toDialogueIndex: number,
  ) => void;
};

export function BlockEditor({
  block,
  diaryId,
  blockIndex,
  characters,
  projectCharacterIds,
  assets,
  updateBlock,
  remove,
  moveBlock,
  moveDialogue,
}: Props) {
  const cast = projectCharacterIds
    .map((id) => characters.find((item) => item.id === id))
    .filter(Boolean) as Character[];
  const blockDurationSeconds = calculateBlock(block, characters).duration;

  return (
    <section
      className="block-card"
      onDragOver={(event) => {
        if (!hasBlockDragData(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        const from = readBlockDragData(event.dataTransfer, diaryId);
        if (!from) return;
        event.preventDefault();
        event.stopPropagation();
        const after =
          event.clientY >= event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2;
        moveBlock(from.blockIndex, blockIndex + (after ? 1 : 0));
      }}
    >
      <div className="asset-control">
        <span
          className="drag-handle"
          role="button"
          aria-label="コンテンツを並べ替え"
          title="ドラッグしてコンテンツを並べ替え"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(BLOCK_DRAG_TYPE, JSON.stringify({ diaryId, blockIndex }));
          }}
        >
          ⠿
        </span>
        <select
          className="asset-select"
          aria-label="素材"
          value={block.asset?.assetId ?? ""}
          onChange={(event) => {
            const asset = assets.find((item) => item.id === event.target.value);
            updateBlock((draft) => {
              draft.asset = asset
                ? {
                    assetId: asset.id,
                    type: asset.kind as "image" | "video",
                    url: `/api/files/assets/${asset.id}`,
                    displayArea: "full",
                    sourceDurationSeconds: asset.kind === "video" ? getAssetDurationSeconds(asset) : null,
                    trim: { top: 0, right: 0, bottom: 0, left: 0 },
                    startSeconds: 0,
                    endSeconds: null,
                    volume: 1,
                    shortageMode: "freeze",
                    fadeOutSeconds: null,
                  }
                : null;
            });
          }}
        >
          <option value="">基本背景</option>
          {assets
            .filter((item) => item.status === "ready" && item.kind !== "psd")
            .map((item) => (
              <option value={item.id} key={item.id}>
                {item.originalName}
              </option>
            ))}
        </select>
        {block.asset ? (
          <>
            <label>
              表示エリア
              <select
                value={block.asset.displayArea}
                onChange={(event) =>
                  updateBlock((draft) => {
                    draft.asset!.displayArea = event.target.value as "full" | "above-dialogue";
                  })
                }
              >
                <option value="full">画面全体</option>
                <option value="above-dialogue">字幕の上側</option>
              </select>
            </label>
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <label key={side}>
                {side}
                <input
                  type="number"
                  min="0"
                  value={block.asset!.trim[side]}
                  onChange={(event) =>
                    updateBlock((draft) => {
                      draft.asset!.trim[side] = Number(event.target.value);
                    })
                  }
                />
              </label>
            ))}
            {block.asset.type === "video" ? (
              <VideoAssetControls
                asset={block.asset}
                blockDurationSeconds={blockDurationSeconds}
                updateAsset={(recipe) =>
                  updateBlock((draft) => {
                    recipe(draft.asset!);
                  })
                }
              />
            ) : null}
          </>
        ) : null}
        <button
          className="icon danger remove-block"
          title="このコンテンツを削除"
          aria-label="このコンテンツを削除"
          onClick={remove}
        >
          ×
        </button>
      </div>
      {block.dialogues.map((dialogue, index) => (
        <DialogueEditor
          key={dialogue.id}
          dialogue={dialogue}
          index={index}
          characters={cast}
          dragLocation={{ diaryId, blockIndex, dialogueIndex: index }}
          onDropDialogue={(from, toDialogueIndex) =>
            moveDialogue(diaryId, from.blockIndex, from.dialogueIndex, blockIndex, toDialogueIndex)
          }
          updateDialogue={(recipe) => updateBlock((draft) => recipe(draft.dialogues[index]))}
          remove={() => updateBlock((draft) => draft.dialogues.splice(index, 1))}
        />
      ))}
      {block.dialogues.length === 0 ? (
        <label className="duration-field">
          無言ブロックの表示時間
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={block.durationSeconds ?? 3}
            onChange={(event) =>
              updateBlock((draft) => {
                draft.durationSeconds = Number(event.target.value);
              })
            }
          />
          秒
        </label>
      ) : null}
      <div
        className="dialogue-footer"
        onDragOver={(event) => {
          if (hasDialogueDragData(event.dataTransfer)) event.preventDefault();
        }}
        onDrop={(event) => {
          const from = readDialogueDragData(event.dataTransfer, diaryId);
          if (!from) return;
          event.preventDefault();
          moveDialogue(diaryId, from.blockIndex, from.dialogueIndex, blockIndex, block.dialogues.length);
        }}
      >
        <button
          className="add-dialogue"
          disabled={cast.length === 0}
          onClick={() =>
            updateBlock((draft) => {
              draft.durationSeconds = null;
              draft.dialogues.push(createDialogue(cast[0].id));
            })
          }
        >
          ＋ セリフを追加
        </button>
        <label className="end-hold-field">
          末尾の余白
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="既定"
            value={block.endHoldSeconds ?? ""}
            onChange={(event) =>
              updateBlock((draft) => {
                draft.endHoldSeconds = event.target.value === "" ? null : Number(event.target.value);
              })
            }
          />
          秒
        </label>
      </div>
    </section>
  );
}
