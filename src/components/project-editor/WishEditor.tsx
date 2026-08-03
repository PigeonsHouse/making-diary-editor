"use client";

import { createDialogue } from "@/domain/defaults";
import type { Character, ProjectDocument } from "@/domain/types";
import { AudioOverrideEditor } from "./AudioSettings";
import { DialogueEditor } from "./DialogueEditor";
import { WISH_LIST_DIALOGUE_SCOPE } from "./dialogue-dnd";
import type { AssetRow, UpdateProject } from "./types";

export function WishEditor({
  project,
  characters,
  assets,
  update,
}: {
  project: ProjectDocument;
  characters: Character[];
  assets: AssetRow[];
  update: UpdateProject;
}) {
  if (!project.wishList) {
    return (
      <button
        className="notebook-add"
        onClick={() =>
          update((draft) => {
            draft.wishList = {
              markdown: "- 作りたいもの",
              dialogues: [],
              durationSeconds: null,
              endHoldSeconds: null,
              sceneIntroSe: { mode: "inherit" },
              bgm: { mode: "inherit" },
            };
          })
        }
      >
        ＋ 今作りたいものリスト
      </button>
    );
  }

  const cast = project.characterIds
    .map((id) => characters.find((item) => item.id === id))
    .filter(Boolean) as Character[];

  return (
    <section className="wish-editor">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WISH LIST</p>
          <h2>今作りたいもの</h2>
        </div>
        <button
          className="icon danger"
          onClick={() =>
            update((draft) => {
              draft.wishList = null;
            })
          }
        >
          ×
        </button>
      </div>
      <div className="scene-audio-controls wish-audio-controls">
        <AudioOverrideEditor
          label="シーン冒頭SE"
          value={project.wishList.sceneIntroSe}
          projectDefault={project.audio.sceneIntroSe}
          assets={assets}
          noneLabel="SEなし"
          onChange={(value) =>
            update((draft) => {
              draft.wishList!.sceneIntroSe = value;
            })
          }
        />
        <AudioOverrideEditor
          label="BGM"
          value={project.wishList.bgm}
          projectDefault={project.audio.bgm}
          assets={assets}
          noneLabel="BGMなし"
          onChange={(value) =>
            update((draft) => {
              draft.wishList!.bgm = value;
            })
          }
        />
      </div>
      <textarea
        value={project.wishList.markdown}
        onChange={(event) =>
          update((draft) => {
            draft.wishList!.markdown = event.target.value;
          })
        }
      />
      <p className="hint">Markdownの中黒リストとインデントに対応</p>
      <div className="wish-dialogues">
        {project.wishList.dialogues.map((dialogue, index) => (
          <DialogueEditor
            key={dialogue.id}
            dialogue={dialogue}
            index={index}
            characters={cast}
            dragLocation={{ diaryId: WISH_LIST_DIALOGUE_SCOPE, blockIndex: 0, dialogueIndex: index }}
            onDropDialogue={(from, toDialogueIndex) =>
              update((draft) => {
                const dialogues = draft.wishList!.dialogues;
                const [moved] = dialogues.splice(from.dialogueIndex, 1);
                if (!moved) return;
                const insertionIndex = from.dialogueIndex < toDialogueIndex ? toDialogueIndex - 1 : toDialogueIndex;
                dialogues.splice(Math.max(0, Math.min(insertionIndex, dialogues.length)), 0, moved);
              })
            }
            updateDialogue={(recipe) => update((draft) => recipe(draft.wishList!.dialogues[index]))}
            remove={() => update((draft) => draft.wishList!.dialogues.splice(index, 1))}
          />
        ))}
        {project.wishList.dialogues.length === 0 ? (
          <label className="duration-field">
            セリフなしの表示時間
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={project.wishList.durationSeconds ?? 3}
              onChange={(event) =>
                update((draft) => {
                  draft.wishList!.durationSeconds = Number(event.target.value);
                })
              }
            />
            秒
          </label>
        ) : null}
        <div className="dialogue-footer">
          <button
            className="add-dialogue"
            disabled={cast.length === 0}
            onClick={() =>
              update((draft) => {
                draft.wishList!.durationSeconds = null;
                draft.wishList!.dialogues.push(createDialogue(cast[0].id));
              })
            }
          >
            ＋ 作りたいもののセリフを追加
          </button>
          <label className="end-hold-field">
            末尾の余白
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="既定"
              value={project.wishList.endHoldSeconds ?? ""}
              onChange={(event) =>
                update((draft) => {
                  draft.wishList!.endHoldSeconds = event.target.value === "" ? null : Number(event.target.value);
                })
              }
            />
            秒
          </label>
        </div>
      </div>
    </section>
  );
}
