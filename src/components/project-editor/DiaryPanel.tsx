"use client";

import { createBlock } from "@/domain/defaults";
import type { Character, DiaryEntry, ProjectDocument } from "@/domain/types";
import { AssetLibrary } from "./AssetLibrary";
import { AudioOverrideEditor } from "./AudioSettings";
import { BlockEditor } from "./BlockEditor";
import { GeminiButton } from "./GeminiButton";
import type { AssetRow, UpdateProject } from "./types";

type Props = {
  diary: DiaryEntry;
  diaryIndex: number;
  project: ProjectDocument;
  characters: Character[];
  assets: AssetRow[];
  update: UpdateProject;
  onAssetsChanged: (assets: AssetRow[]) => void;
  onRemove: () => void;
  onGenerateDialogues: (memo: string) => Promise<void>;
  moveDialogue: (
    diaryId: string,
    fromBlockIndex: number,
    fromDialogueIndex: number,
    toBlockIndex: number,
    toDialogueIndex: number,
  ) => void;
};

export function DiaryPanel({
  diary,
  diaryIndex,
  project,
  characters,
  assets,
  update,
  onAssetsChanged,
  onRemove,
  onGenerateDialogues,
  moveDialogue,
}: Props) {
  return (
    <div
      id={`panel-diary-${diary.id}`}
      role="tabpanel"
      aria-labelledby={`tab-diary-${diary.id}`}
      className="editor-tab-panel"
    >
      <AssetLibrary assets={assets} onChanged={onAssetsChanged} />
      <article className="diary-card selected">
        <div className="diary-heading">
          <span className="order-badge">{String(diaryIndex + 1).padStart(2, "0")}</span>
          <input
            type="date"
            value={diary.date}
            onChange={(event) =>
              update((draft) => {
                draft.diaries[diaryIndex].date = event.target.value;
              })
            }
          />
          <input
            className={`grow ${diary.subtitle.trim() === "" ? "invalid" : ""}`}
            placeholder="その日の概要"
            value={diary.subtitle}
            onChange={(event) =>
              update((draft) => {
                draft.diaries[diaryIndex].subtitle = event.target.value;
              })
            }
          />
          <button className="icon danger" title="この日誌を削除" onClick={onRemove}>
            ×
          </button>
        </div>
        <div className="scene-audio-controls">
          <AudioOverrideEditor
            label="シーン冒頭SE"
            value={diary.sceneIntroSe}
            projectDefault={project.audio.sceneIntroSe}
            assets={assets}
            noneLabel="SEなし"
            onChange={(value) =>
              update((draft) => {
                draft.diaries[diaryIndex].sceneIntroSe = value;
              })
            }
          />
          <AudioOverrideEditor
            label="BGM"
            value={diary.bgm}
            projectDefault={project.audio.bgm}
            assets={assets}
            noneLabel="BGMなし"
            onChange={(value) =>
              update((draft) => {
                draft.diaries[diaryIndex].bgm = value;
              })
            }
          />
        </div>
        {diary.blocks.map((block, blockIndex) => (
          <BlockEditor
            key={block.id}
            block={block}
            diaryId={diary.id}
            blockIndex={blockIndex}
            characters={characters}
            projectCharacterIds={project.characterIds}
            assets={assets}
            projectContentSe={project.audio.contentSe}
            updateBlock={(recipe) =>
              update((draft) => {
                recipe(draft.diaries[diaryIndex].blocks[blockIndex]);
              })
            }
            remove={() => update((draft) => draft.diaries[diaryIndex].blocks.splice(blockIndex, 1))}
            moveBlock={(fromBlockIndex, toBlockIndex) =>
              update((draft) => {
                const blocks = draft.diaries[diaryIndex].blocks;
                const [moved] = blocks.splice(fromBlockIndex, 1);
                if (!moved) return;
                const adjustedIndex = fromBlockIndex < toBlockIndex ? toBlockIndex - 1 : toBlockIndex;
                blocks.splice(Math.max(0, Math.min(adjustedIndex, blocks.length)), 0, moved);
              })
            }
            moveDialogue={moveDialogue}
          />
        ))}
        <div className="diary-actions">
          <button
            className="secondary"
            onClick={() =>
              update((draft) => {
                draft.diaries[diaryIndex].blocks.push(createBlock());
              })
            }
          >
            ＋ コンテンツ
          </button>
          <GeminiButton onGenerate={onGenerateDialogues} />
        </div>
      </article>
    </div>
  );
}
