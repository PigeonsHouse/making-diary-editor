"use client";

import { createDialogue } from "@/domain/defaults";
import type { Character, ContentBlock } from "@/domain/types";
import { DialogueEditor } from "./DialogueEditor";
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
  moveDialogue,
}: Props) {
  const cast = projectCharacterIds
    .map((id) => characters.find((item) => item.id === id))
    .filter(Boolean) as Character[];

  return (
    <section className="block-card">
      <div className="asset-control">
        <span className="drag-handle" aria-hidden="true">
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
              <>
                <label>
                  音量
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    disabled={block.asset.shortageMode === "fit-duration"}
                    value={block.asset.volume}
                    onChange={(event) =>
                      updateBlock((draft) => {
                        draft.asset!.volume = Number(event.target.value);
                      })
                    }
                  />
                </label>
                <select
                  value={block.asset.shortageMode}
                  onChange={(event) =>
                    updateBlock((draft) => {
                      draft.asset!.shortageMode = event.target.value as "loop" | "freeze" | "fade-out" | "fit-duration";
                    })
                  }
                >
                  <option value="loop">ループ</option>
                  <option value="freeze">最終フレーム</option>
                  <option value="fade-out">フェードアウト</option>
                  <option value="fit-duration">尺に合わせる</option>
                </select>
              </>
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
