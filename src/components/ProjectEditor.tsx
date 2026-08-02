"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {createBlock, createDialogue, createDiary} from "@/domain/defaults";
import {validateProject} from "@/domain/timeline";
import type {
  Character,
  ContentBlock,
  Dialogue,
  ProjectDocument,
  ProjectRecord,
} from "@/domain/types";
import {VideoPreview} from "./VideoPreview";
import {VoiceSettingsSliders} from "./VoiceSettingsSliders";

type CharacterRow = {id: string; revision: number; data: Character};
type AssetRow = {
  id: string;
  kind: "image" | "video" | "psd";
  originalName: string;
  status: string;
  metadata: Record<string, unknown>;
  error: string | null;
};

type EditorTab = "general" | "wish" | `diary:${string}`;

const DIARY_DIALOGUE_DRAG_TYPE = "application/x-making-diary-dialogue";

const hasDiaryDialogue = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).includes(DIARY_DIALOGUE_DRAG_TYPE);

function readDiaryDialogue(dataTransfer: DataTransfer, diaryId: string): DialogueDragLocation | null {
  try {
    const value = JSON.parse(dataTransfer.getData(DIARY_DIALOGUE_DRAG_TYPE)) as Partial<DialogueDragLocation>;
    if (value.diaryId !== diaryId || !Number.isInteger(value.blockIndex) || !Number.isInteger(value.dialogueIndex)) return null;
    return value as DialogueDragLocation;
  } catch {
    return null;
  }
}

export function ProjectEditor({projectId}: {projectId: string}) {
  const [record, setRecord] = useState<ProjectRecord | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [saveState, setSaveState] = useState("読み込み中");
  const [renderState, setRenderState] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("general");
  const skipSave = useRef(true);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((response) => response.json()),
      fetch("/api/characters").then((response) => response.json()),
      fetch("/api/assets").then((response) => response.json()),
    ]).then(([project, characterRows, assetRows]: [ProjectRecord, CharacterRow[], AssetRow[]]) => {
      const cleanedLegacyOverrides = cleanLegacyVoiceOverrides(project.document);
      setRecord({...project, document: cleanedLegacyOverrides.document});
      setCharacters(characterRows.map((row) => row.data));
      setAssets(assetRows);
      setSaveState(cleanedLegacyOverrides.changed ? "未保存" : "保存済み");
      skipSave.current = !cleanedLegacyOverrides.changed;
    }).catch(() => setSaveState("読み込み失敗"));
  }, [projectId]);

  const update = useCallback((recipe: (draft: ProjectDocument) => void) => {
    setRecord((current) => {
      if (!current) return current;
      const document = structuredClone(current.document);
      recipe(document);
      return {...current, document};
    });
    setSaveState("未保存");
  }, []);

  useEffect(() => {
    if (!record) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaveState("保存中…");
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({revision: record.revision, document: record.document}),
      });
      if (response.status === 409) return setSaveState("競合：再読み込みしてください");
      if (!response.ok) return setSaveState("保存失敗");
      skipSave.current = true;
      setRecord(await response.json());
      setSaveState("保存済み");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [record]);

  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({block: "nearest", inline: "nearest"});
  }, [activeTab, record?.document.diaries.length]);

  if (!record) return <div className="page"><div className="empty-state">{saveState}</div></div>;
  const project = record.document;
  const issues = validateProject(project, characters);

  const addDiary = () => {
    const diary = createDiary();
    update((draft) => draft.diaries.push(diary));
    setActiveTab(`diary:${diary.id}`);
  };
  const sortDiaries = () => update((draft) => draft.diaries.sort((a, b) => a.date.localeCompare(b.date)));
  const removeDiary = (diaryIndex: number) => {
    const nextDiary = project.diaries[diaryIndex + 1] ?? project.diaries[diaryIndex - 1];
    update((draft) => draft.diaries.splice(diaryIndex, 1));
    setActiveTab(nextDiary ? `diary:${nextDiary.id}` : "general");
  };
  const moveDiaryDialogue = (
    diaryId: string,
    fromBlockIndex: number,
    fromDialogueIndex: number,
    toBlockIndex: number,
    toDialogueIndex: number,
  ) => update((draft) => {
    const diary = draft.diaries.find((item) => item.id === diaryId);
    if (!diary) return;
    const sourceBlock = diary.blocks[fromBlockIndex];
    const targetBlock = diary.blocks[toBlockIndex];
    if (!sourceBlock || !targetBlock) return;
    const [dialogue] = sourceBlock.dialogues.splice(fromDialogueIndex, 1);
    if (!dialogue) return;
    let insertionIndex = toDialogueIndex;
    if (sourceBlock === targetBlock && fromDialogueIndex < insertionIndex) insertionIndex -= 1;
    targetBlock.dialogues.splice(Math.max(0, Math.min(insertionIndex, targetBlock.dialogues.length)), 0, dialogue);
    targetBlock.durationSeconds = null;
    if (sourceBlock !== targetBlock && sourceBlock.dialogues.length === 0) sourceBlock.durationSeconds = 3;
  });
  const render = async () => {
    setRenderState("キューへ追加中…");
    const response = await fetch("/api/render", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({projectId}),
    });
    const body = await response.json();
    if (!response.ok) return setRenderState(body.error ?? "開始できませんでした");
    setRenderState("待機中 0%");
    const events = new EventSource(`/api/render/${body.id}/events`);
    events.onmessage = (event) => {
      const job = JSON.parse(event.data);
      setRenderState(job.status === "completed"
        ? "完成しました"
        : job.status === "failed"
          ? `失敗: ${job.error}`
          : `${job.status === "queued" ? "待機中" : "レンダリング中"} ${job.progress}%`);
      if (["completed", "failed", "missing"].includes(job.status)) events.close();
    };
  };
  const generateDialogues = async (diaryId: string, memo: string) => {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        memo,
        characters: project.characterIds.map((id) => characters.find((item) => item.id === id))
          .filter(Boolean).map((item) => ({
            id: item!.id,
            name: item!.name,
            personality: item!.personality,
          })),
      }),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    const generated: Array<{characterId: string; text: string}> = await response.json();
    update((draft) => {
      const diary = draft.diaries.find((item) => item.id === diaryId)!;
      const block = createBlock();
      block.durationSeconds = null;
      block.dialogues = generated.map((item) => ({...createDialogue(item.characterId), text: item.text}));
      diary.blocks.push(block);
    });
  };

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <input
          className="title-input"
          value={project.name}
          onChange={(event) => update((draft) => { draft.name = event.target.value; })}
        />
        <div className={`save-state ${saveState.includes("失敗") || saveState.includes("競合") ? "bad" : ""}`}>
          <span />{saveState}
        </div>
        <button className="primary" disabled={issues.length > 0 || renderState.includes("中")} onClick={render}>
          レンダリング
        </button>
        {renderState ? <span className="render-state">{renderState}</span> : null}
      </div>

      {issues.length ? (
        <div className="validation-banner">
          <strong>{issues.length}件の修正が必要です</strong>
          <span>{issues[0].message}</span>
        </div>
      ) : null}

      <div className="editor-layout">
        <section className="editor-scroll">
          <div className="editor-tabs-toolbar">
            <div ref={tabsRef} className="editor-tabs" role="tablist" aria-label="プロジェクトの編集項目">
              <button
                id="tab-general"
                role="tab"
                aria-selected={activeTab === "general"}
                aria-controls="panel-general"
                className={activeTab === "general" ? "active" : ""}
                onClick={() => setActiveTab("general")}
              >
                <span>一般設定</span>
              </button>
              <button
                id="tab-wish"
                role="tab"
                aria-selected={activeTab === "wish"}
                aria-controls="panel-wish"
                className={activeTab === "wish" ? "active" : ""}
                onClick={() => setActiveTab("wish")}
              >
                <span>今作りたいもの</span>
              </button>
              {project.diaries.map((diary, diaryIndex) => {
                const tabId: EditorTab = `diary:${diary.id}`;
                return (
                  <button
                    id={`tab-diary-${diary.id}`}
                    role="tab"
                    aria-selected={activeTab === tabId}
                    aria-controls={`panel-diary-${diary.id}`}
                    className={activeTab === tabId ? "active" : ""}
                    key={diary.id}
                    title={diary.subtitle || `${diary.date}の日誌`}
                    onClick={() => setActiveTab(tabId)}
                  >
                    <small>{String(diaryIndex + 1).padStart(2, "0")}</small>
                    <span>{diary.date || "日付未設定"}</span>
                  </button>
                );
              })}
            </div>
            <div className="editor-tab-actions">
              {project.diaries.length > 1 ? (
                <button className="secondary sort-diaries" onClick={sortDiaries}>日付順</button>
              ) : null}
              <button className="primary add-diary-tab" onClick={addDiary}>＋ 日誌を追加</button>
            </div>
          </div>

          {activeTab === "general" ? (
            <div id="panel-general" role="tabpanel" aria-labelledby="tab-general" className="editor-tab-panel">
              <CastEditor project={project} characters={characters} update={update} />
              <AssetLibrary assets={assets} onChanged={setAssets} />
            </div>
          ) : null}

          {activeTab === "wish" ? (
            <div id="panel-wish" role="tabpanel" aria-labelledby="tab-wish" className="editor-tab-panel">
              <WishEditor project={project} characters={characters} update={update} />
            </div>
          ) : null}

          {project.diaries.map((diary, diaryIndex) => activeTab === `diary:${diary.id}` ? (
            <article
              id={`panel-diary-${diary.id}`}
              role="tabpanel"
              aria-labelledby={`tab-diary-${diary.id}`}
              className="diary-card editor-tab-panel selected"
              key={diary.id}
            >
              <div className="diary-heading">
                <span className="order-badge">{String(diaryIndex + 1).padStart(2, "0")}</span>
                <input type="date" value={diary.date} onChange={(event) => update((draft) => {
                  draft.diaries[diaryIndex].date = event.target.value;
                })} />
                <input
                  className={`grow ${diary.subtitle.trim() === "" ? "invalid" : ""}`}
                  placeholder="その日の概要"
                  value={diary.subtitle}
                  onChange={(event) => update((draft) => {
                    draft.diaries[diaryIndex].subtitle = event.target.value;
                  })}
                />
                <button className="icon danger" title="この日誌を削除" onClick={() => removeDiary(diaryIndex)}>×</button>
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
                  updateBlock={(recipe) => update((draft) => {
                    recipe(draft.diaries[diaryIndex].blocks[blockIndex]);
                  })}
                  remove={() => update((draft) => draft.diaries[diaryIndex].blocks.splice(blockIndex, 1))}
                  moveDialogue={moveDiaryDialogue}
                />
              ))}
              <div className="diary-actions">
                <button className="secondary" onClick={() => update((draft) => {
                  draft.diaries[diaryIndex].blocks.push(createBlock());
                })}>＋ コンテンツ</button>
                <GeminiButton onGenerate={(memo) => generateDialogues(diary.id, memo)} />
              </div>
            </article>
          ) : null)}
        </section>
        <aside className="preview-column">
          <VideoPreview project={project} characters={characters} />
          <div className="preview-meta">
            <span>1920 × 1080</span><span>30 FPS</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function cleanLegacyVoiceOverrides(document: ProjectDocument) {
  const cleaned = structuredClone(document);
  let changed = false;
  const dialogues = [
    ...(cleaned.wishList?.dialogues ?? []),
    ...cleaned.diaries.flatMap((diary) => diary.blocks.flatMap((block) => block.dialogues)),
  ];
  for (const dialogue of dialogues) {
    const overrides = dialogue.voiceOverrides;
    const legacyInflated = ["styleName", "speed", "pitch", "intonation", "volume"]
      .every((key) => Object.hasOwn(overrides, key));
    if (!legacyInflated) continue;
    if (overrides.styleName === "ノーマル") delete overrides.styleName;
    if (overrides.speed === 1) delete overrides.speed;
    if (overrides.pitch === 0) delete overrides.pitch;
    if (overrides.intonation === 1) delete overrides.intonation;
    if (overrides.volume === 1) delete overrides.volume;
    changed = true;
  }
  return {document: cleaned, changed};
}

function CastEditor({project, characters, update}: {
  project: ProjectDocument;
  characters: Character[];
  update: (recipe: (draft: ProjectDocument) => void) => void;
}) {
  const available = characters.filter((item) => !project.characterIds.includes(item.id));
  return (
    <details className="panel" open>
      <summary><span>登場キャラクター</span><small>{project.characterIds.length}人</small></summary>
      <div className="cast-row">
        {project.characterIds.map((id, index) => {
          const character = characters.find((item) => item.id === id);
          return (
            <div className="cast-chip" key={id} style={{borderColor: character?.color}}>
              <span>{index % 2 === 0 ? "右" : "左"}</span>{character?.name ?? "不明"}
              <button onClick={() => update((draft) => {
                draft.characterIds.splice(index, 1);
                delete draft.characterAvatarOverrides[id];
              })}>×</button>
            </div>
          );
        })}
        {available.length ? (
          <select value="" onChange={(event) => update((draft) => {
            const characterId = event.target.value;
            const index = draft.characterIds.length;
            draft.characterIds.push(characterId);
            draft.characterAvatarOverrides[characterId] = {flipHorizontal: index % 2 === 1};
          })}>
            <option value="">＋ 追加</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        ) : null}
      </div>
      <div className="project-character-layout">
        <span>立ち絵位置（この動画で上書き）</span>
        {project.characterIds.map((characterId) => {
          const character = characters.find((item) => item.id === characterId);
          const overrides = project.characterAvatarOverrides[characterId];
          return (
            <label key={characterId} style={{"--character-color": character?.color ?? "#64748b"} as React.CSSProperties}>
              {character?.name ?? "不明"}
              <span>X</span>
              <input type="number" placeholder={String(character?.avatar.edgeOffsetXPx ?? 0)}
                value={overrides?.edgeOffsetXPx ?? ""} onChange={(event) => update((draft) => {
                  const values = draft.characterAvatarOverrides[characterId] ??= {};
                  if (event.target.value === "") delete values.edgeOffsetXPx;
                  else values.edgeOffsetXPx = Number(event.target.value);
                })} />
              <span>Y</span>
              <input type="number" min="0" placeholder={String(character?.avatar.peekYPx ?? 180)}
                value={overrides?.peekYPx ?? ""} onChange={(event) => update((draft) => {
                  const values = draft.characterAvatarOverrides[characterId] ??= {};
                  if (event.target.value === "") delete values.peekYPx;
                  else values.peekYPx = Number(event.target.value);
                })} />
              px
              <span className="project-character-flip">
                <input type="checkbox" checked={overrides?.flipHorizontal ?? project.characterIds.indexOf(characterId) % 2 === 1}
                  onChange={(event) => update((draft) => {
                    const values = draft.characterAvatarOverrides[characterId] ??= {};
                    values.flipHorizontal = event.target.checked;
                  })} />
                左右反転
              </span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

function WishEditor({project, characters, update}: {
  project: ProjectDocument;
  characters: Character[];
  update: (recipe: (draft: ProjectDocument) => void) => void;
}) {
  if (!project.wishList) {
    return <button className="notebook-add" onClick={() => update((draft) => {
      draft.wishList = {markdown: "- 作りたいもの", dialogues: [], durationSeconds: null, endHoldSeconds: null};
    })}>＋ 今作りたいものリスト</button>;
  }
  const cast = project.characterIds.map((id) => characters.find((item) => item.id === id)).filter(Boolean) as Character[];
  return (
    <section className="wish-editor">
      <div className="section-heading"><div><p className="eyebrow">WISH LIST</p><h2>今作りたいもの</h2></div>
        <button className="icon danger" onClick={() => update((draft) => { draft.wishList = null; })}>×</button>
      </div>
      <textarea value={project.wishList.markdown} onChange={(event) => update((draft) => {
        draft.wishList!.markdown = event.target.value;
      })} />
      <p className="hint">Markdownの中黒リストとインデントに対応</p>
      <div className="wish-dialogues">
        {project.wishList.dialogues.map((dialogue, index) => (
          <DialogueEditor key={dialogue.id} dialogue={dialogue} index={index} characters={cast}
            updateDialogue={(recipe) => update((draft) => recipe(draft.wishList!.dialogues[index]))}
            remove={() => update((draft) => draft.wishList!.dialogues.splice(index, 1))}
          />
        ))}
        {project.wishList.dialogues.length === 0 ? (
          <label className="duration-field">セリフなしの表示時間
            <input type="number" min="0.1" step="0.1" value={project.wishList.durationSeconds ?? 3} onChange={(event) =>
              update((draft) => { draft.wishList!.durationSeconds = Number(event.target.value); })
            } />秒
          </label>
        ) : null}
        <div className="dialogue-footer">
          <button className="add-dialogue" disabled={cast.length === 0} onClick={() => update((draft) => {
            draft.wishList!.durationSeconds = null;
            draft.wishList!.dialogues.push(createDialogue(cast[0].id));
          })}>＋ 作りたいもののセリフを追加</button>
          <label className="end-hold-field">末尾の余白
            <input type="number" min="0" step="0.1" placeholder="既定" value={project.wishList.endHoldSeconds ?? ""} onChange={(event) =>
              update((draft) => { draft.wishList!.endHoldSeconds = event.target.value === "" ? null : Number(event.target.value); })
            } />秒
          </label>
        </div>
      </div>
    </section>
  );
}

function BlockEditor({block, diaryId, blockIndex, characters, projectCharacterIds, assets, updateBlock, remove, moveDialogue}: {
  block: ContentBlock;
  diaryId: string;
  blockIndex: number;
  characters: Character[];
  projectCharacterIds: string[];
  assets: AssetRow[];
  updateBlock: (recipe: (draft: ContentBlock) => void) => void;
  remove: () => void;
  moveDialogue: (diaryId: string, fromBlockIndex: number, fromDialogueIndex: number,
    toBlockIndex: number, toDialogueIndex: number) => void;
}) {
  const cast = projectCharacterIds.map((id) => characters.find((item) => item.id === id)).filter(Boolean) as Character[];
  return (
    <section className="block-card">
      <div className="block-heading">
        <span className="drag-handle">⠿</span>
        <input placeholder="コンテンツ名（任意）" value={block.title} onChange={(event) =>
          updateBlock((draft) => { draft.title = event.target.value; })
        } />
        <button className="icon danger" onClick={remove}>×</button>
      </div>
      <div className="asset-control">
        <select value={block.asset?.assetId ?? ""} onChange={(event) => {
          const asset = assets.find((item) => item.id === event.target.value);
          updateBlock((draft) => {
            draft.asset = asset ? {
              assetId: asset.id,
              type: asset.kind as "image" | "video",
              url: `/api/files/assets/${asset.id}`,
              trim: {top: 0, right: 0, bottom: 0, left: 0},
              startSeconds: 0,
              endSeconds: null,
              volume: 1,
              shortageMode: "freeze",
              fadeOutSeconds: null,
            } : null;
          });
        }}>
          <option value="">基本背景</option>
          {assets.filter((item) => item.status === "ready" && item.kind !== "psd").map((item) =>
            <option value={item.id} key={item.id}>{item.originalName}</option>)}
        </select>
        {block.asset ? (
          <>
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <label key={side}>{side}<input type="number" min="0" value={block.asset!.trim[side]} onChange={(event) =>
                updateBlock((draft) => { draft.asset!.trim[side] = Number(event.target.value); })
              } /></label>
            ))}
            {block.asset.type === "video" ? (
              <>
                <label>音量<input type="number" min="0" step="0.1" disabled={block.asset.shortageMode === "fit-duration"}
                  value={block.asset.volume} onChange={(event) => updateBlock((draft) => {
                    draft.asset!.volume = Number(event.target.value);
                  })} /></label>
                <select value={block.asset.shortageMode} onChange={(event) => updateBlock((draft) => {
                  draft.asset!.shortageMode = event.target.value as "loop" | "freeze" | "fade-out" | "fit-duration";
                })}>
                  <option value="loop">ループ</option>
                  <option value="freeze">最終フレーム</option>
                  <option value="fade-out">フェードアウト</option>
                  <option value="fit-duration">尺に合わせる</option>
                </select>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      {block.dialogues.map((dialogue, index) => (
        <DialogueEditor
          key={dialogue.id}
          dialogue={dialogue}
          index={index}
          characters={cast}
          dragLocation={{diaryId, blockIndex, dialogueIndex: index}}
          onDropDialogue={(from, toDialogueIndex) => moveDialogue(
            diaryId, from.blockIndex, from.dialogueIndex, blockIndex, toDialogueIndex,
          )}
          updateDialogue={(recipe) => updateBlock((draft) => recipe(draft.dialogues[index]))}
          remove={() => updateBlock((draft) => draft.dialogues.splice(index, 1))}
        />
      ))}
      {block.dialogues.length === 0 ? (
        <label className="duration-field">無言ブロックの表示時間
          <input type="number" min="0.1" step="0.1" value={block.durationSeconds ?? 3} onChange={(event) =>
            updateBlock((draft) => { draft.durationSeconds = Number(event.target.value); })
          } />秒
        </label>
      ) : null}
      <div className="dialogue-footer" onDragOver={(event) => {
        if (hasDiaryDialogue(event.dataTransfer)) event.preventDefault();
      }} onDrop={(event) => {
        const from = readDiaryDialogue(event.dataTransfer, diaryId);
        if (!from) return;
        event.preventDefault();
        moveDialogue(diaryId, from.blockIndex, from.dialogueIndex, blockIndex, block.dialogues.length);
      }}>
        <button className="add-dialogue" disabled={cast.length === 0} onClick={() => updateBlock((draft) => {
          draft.durationSeconds = null;
          draft.dialogues.push(createDialogue(cast[0].id));
        })}>＋ セリフを追加</button>
        <label className="end-hold-field">末尾の余白
          <input type="number" min="0" step="0.1" placeholder="既定" value={block.endHoldSeconds ?? ""} onChange={(event) =>
            updateBlock((draft) => { draft.endHoldSeconds = event.target.value === "" ? null : Number(event.target.value); })
          } />秒
        </label>
      </div>
    </section>
  );
}

type DialogueDragLocation = {diaryId: string; blockIndex: number; dialogueIndex: number};

function DialogueEditor({dialogue, index, characters, updateDialogue, remove, dragLocation, onDropDialogue}: {
  dialogue: Dialogue;
  index: number;
  characters: Character[];
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
  remove: () => void;
  dragLocation?: DialogueDragLocation;
  onDropDialogue?: (from: DialogueDragLocation, toDialogueIndex: number) => void;
}) {
  const character = characters.find((item) => item.id === dialogue.characterId) ?? characters[0];
  const [kanaOpen, setKanaOpen] = useState(dialogue.kana !== null);
  const [kanaState, setKanaState] = useState("");
  const initialSignature = useRef("__generate__");
  const updateDialogueRef = useRef(updateDialogue);
  updateDialogueRef.current = updateDialogue;
  useEffect(() => {
    if (!character) return;
    const voice = {...character.voice, ...dialogue.voiceOverrides};
    const input = {
      ...voice,
      voicevoxName: character.voicevoxName,
      text: dialogue.text,
      kana: dialogue.kana,
    };
    const signature = JSON.stringify(input);
    if (signature === initialSignature.current) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify(input),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const result = await response.json();
        if (cancelled) return;
        initialSignature.current = signature;
        if (dialogue.audio.status === "ready" && dialogue.audio.inputHash === result.hash) return;
        updateDialogueRef.current((draft) => { draft.audio.status = "generating"; });
        const audio = new window.Audio(result.url);
        audio.addEventListener("loadedmetadata", () => {
          if (cancelled) return;
          updateDialogueRef.current((draft) => {
            draft.audio = {
              status: "ready",
              url: result.url,
              durationSeconds: audio.duration,
              error: null,
              inputHash: result.hash,
            };
          });
        }, {once: true});
        audio.addEventListener("error", () => {
          if (cancelled) return;
          updateDialogueRef.current((draft) => {
            draft.audio.status = "error";
            draft.audio.error = "生成音声を読み込めませんでした";
          });
        }, {once: true});
      } catch (error) {
        if (cancelled) return;
        updateDialogueRef.current((draft) => {
          draft.audio.status = "error";
          draft.audio.error = error instanceof Error ? error.message : "音声生成に失敗しました";
        });
      }
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    dialogue.text,
    dialogue.kana,
    dialogue.characterId,
    dialogue.voiceOverrides.styleName,
    dialogue.voiceOverrides.speed,
    dialogue.voiceOverrides.pitch,
    dialogue.voiceOverrides.intonation,
    dialogue.voiceOverrides.volume,
    character?.voicevoxName,
    character?.voice.styleName,
    character?.voice.speed,
    character?.voice.pitch,
    character?.voice.intonation,
    character?.voice.volume,
  ]);

  const loadDefaultKana = async () => {
    if (!character) return;
    setKanaState("取得中…");
    try {
      const response = await fetch("/api/voice/kana", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          text: dialogue.text,
          voicevoxName: character.voicevoxName,
          styleName: dialogue.voiceOverrides.styleName ?? character.voice.styleName,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "kanaを取得できませんでした");
      updateDialogue((draft) => { draft.kana = result.kana; });
      setKanaOpen(true);
      setKanaState("");
    } catch (error) {
      setKanaState(error instanceof Error ? error.message : "kanaを取得できませんでした");
    }
  };

  return (
    <div className="dialogue-row" style={{"--speaker": character?.color ?? "#64748b"} as React.CSSProperties}
      onDragOver={(event) => {
        if (dragLocation && hasDiaryDialogue(event.dataTransfer)) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!dragLocation || !onDropDialogue) return;
        const from = readDiaryDialogue(event.dataTransfer, dragLocation.diaryId);
        if (!from) return;
        event.preventDefault();
        const after = event.clientY >= event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2;
        onDropDialogue(from, index + (after ? 1 : 0));
      }}>
      <div className={`dialogue-index ${dragLocation ? "draggable" : ""}`} title={dragLocation ? "ドラッグしてセリフを移動" : undefined}
        draggable={Boolean(dragLocation)} onDragStart={(event) => {
          if (!dragLocation) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(DIARY_DIALOGUE_DRAG_TYPE, JSON.stringify(dragLocation));
        }}>{index + 1}</div>
      <select value={dialogue.characterId} onChange={(event) => updateDialogue((draft) => {
        draft.characterId = event.target.value;
      })}>
        {characters.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      <label className="pause-field">手前の余白
        <input type="number" step="0.1" placeholder="既定" value={dialogue.pauseBeforeSeconds ?? ""} onChange={(event) =>
          updateDialogue((draft) => { draft.pauseBeforeSeconds = event.target.value === "" ? null : Number(event.target.value); })
        } />
      </label>
      <textarea value={dialogue.text} onChange={(event) => updateDialogue((draft) => {
        draft.text = event.target.value;
      })} />
      <div className={`audio-status ${dialogue.audio.status}`}>
        {dialogue.audio.status === "ready" && dialogue.audio.url ? (
          <button onClick={() => new window.Audio(dialogue.audio.url!).play()}>▶</button>
        ) : dialogue.audio.status === "generating" ? "生成中" : dialogue.audio.status === "error" ? "!" : "○"}
      </div>
      <button className="icon danger" onClick={remove}>×</button>
      {dialogue.kana === null ? (
        <div className="dialogue-kana-options dialogue-kana-empty">
          <span>読み：本文を使用</span>
          <button className="secondary" disabled={!dialogue.text || kanaState === "取得中…"}
            onClick={() => void loadDefaultKana()}>VOICEVOXからkanaを読み込む</button>
          {kanaState ? <small className={kanaState === "取得中…" ? "" : "error"}>{kanaState}</small> : null}
        </div>
      ) : (
        <details className="dialogue-kana-options" open={kanaOpen}
          onToggle={(event) => setKanaOpen(event.currentTarget.open)}>
          <summary><span>読み（AquesTalk風kana）</span><small>指定あり</small></summary>
          {kanaOpen ? <>
            <textarea aria-label="AquesTalk風kana" value={dialogue.kana}
              onChange={(event) => updateDialogue((draft) => { draft.kana = event.target.value; })} />
            <div className="dialogue-kana-actions">
              <button className="secondary" disabled={kanaState === "取得中…"}
                onClick={() => {
                  if (window.confirm("現在のkanaが消えて、VOICEVOXから取得した値で上書きされます。再取得しますか？")) {
                    void loadDefaultKana();
                  }
                }}>kanaリセット</button>
              <button className="secondary" onClick={() => {
                if (window.confirm("現在のkanaを削除してnullに戻します。読み調整は元に戻せません。続けますか？")) {
                  updateDialogue((draft) => { draft.kana = null; });
                  setKanaOpen(false);
                  setKanaState("");
                }
              }}>nullに戻す</button>
              {kanaState ? <small className={kanaState === "取得中…" ? "" : "error"}>{kanaState}</small> : null}
            </div>
          </> : null}
        </details>
      )}
      {character ? <DialogueVoiceOverrides character={character} dialogue={dialogue} updateDialogue={updateDialogue} /> : null}
      {character && Object.keys(character.psdFilters).length > 0 ? (
        <DialoguePsdOverrides character={character} dialogue={dialogue} updateDialogue={updateDialogue} />
      ) : null}
    </div>
  );
}

function DialoguePsdOverrides({character, dialogue, updateDialogue}: {
  character: Character;
  dialogue: Dialogue;
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(character.avatar.previewUrl);
  const [previewState, setPreviewState] = useState("");
  const selections = {...character.psdDefaults, ...dialogue.psdOverrides};
  const previewSignature = JSON.stringify({filters: character.psdFilters, selections});

  useEffect(() => {
    if (!isOpen || !character.psdAssetId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewState("プレビュー生成中…");
      try {
        const response = await fetch(`/api/psd/${character.psdAssetId}`, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: previewSignature,
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "プレビューを生成できませんでした");
        setPreviewUrl(result.url);
        setPreviewState("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewState(error instanceof Error ? error.message : "プレビューを生成できませんでした");
        }
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, character.psdAssetId, previewSignature]);

  const filterNames = (character.psdFilterOrder.length
    ? character.psdFilterOrder
    : Object.keys(character.psdFilters)
  ).filter((filterName) => character.psdFilters[filterName]);

  return (
    <details className="dialogue-psd-options" open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>立ち絵の上書き <small>{Object.keys(dialogue.psdOverrides).length}件</small></summary>
      {isOpen ? <div className="dialogue-psd-body">
        <div className="dialogue-psd-preview">
          {previewUrl ? <img src={previewUrl} alt="このセリフの立ち絵プレビュー" /> : <span>プレビュー未生成</span>}
          {previewState ? <small>{previewState}</small> : null}
        </div>
        <div className="dialogue-psd-fields">
          {filterNames.map((filterName) => {
            const filter = character.psdFilters[filterName];
            return <label key={filterName}>{filterName}
              <select value={dialogue.psdOverrides[filterName] ?? ""} onChange={(event) => updateDialogue((draft) => {
                if (event.target.value) draft.psdOverrides[filterName] = event.target.value;
                else delete draft.psdOverrides[filterName];
              })}>
                <option value="">既定: {character.psdDefaults[filterName] ?? "未指定"}</option>
                {(filter.choiceOrder.length ? filter.choiceOrder : Object.keys(filter.choices))
                  .filter((choice) => filter.choices[choice])
                  .map((choice) => <option key={choice}>{choice}</option>)}
              </select>
            </label>;
          })}
        </div>
      </div> : null}
    </details>
  );
}

function DialogueVoiceOverrides({character, dialogue, updateDialogue}: {
  character: Character;
  dialogue: Dialogue;
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return <details className="dialogue-voice-options" open={isOpen}
    onToggle={(event) => setIsOpen(event.currentTarget.open)}>
    <summary>音声パラメータの上書き</summary>
    {isOpen ? <VoiceSettingsSliders allowUnset values={dialogue.voiceOverrides} defaults={character.voice}
      onChange={(key, value) => updateDialogue((draft) => {
        if (value === undefined) delete draft.voiceOverrides[key];
        else draft.voiceOverrides[key] = value;
      })} /> : null}
  </details>;
}

function AssetLibrary({assets, onChanged}: {
  assets: AssetRow[];
  onChanged: (assets: AssetRow[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [state, setState] = useState("");
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/assets", {method: "POST", body: form});
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
    const response = await fetch(`/api/assets/${asset.id}`, {method: "DELETE"});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setState(body.error ?? "素材を削除できませんでした");
    else onChanged(assets.filter((item) => item.id !== asset.id));
    setDeletingId(null);
  };
  return (
    <details className="panel">
      <summary><span>素材</span><small>{assets.length}件</small></summary>
      <div className="asset-library">
        <div className="asset-library-toolbar">
          <label className="secondary upload-button">
            {uploading ? "変換中…" : "＋ 画像・動画をアップロード"}
            <input type="file" accept="image/*,video/*,.psd" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
          {state ? <span className="asset-library-state">{state}</span> : null}
        </div>
        <div className="asset-grid">{assets.map((asset) => (
          <article className={`asset-card ${asset.status}`} key={asset.id}>
            <div className="asset-preview">
              {asset.status === "ready" && asset.kind === "image"
                ? <img src={`/api/files/assets/${asset.id}`} alt={asset.originalName} loading="lazy" />
                : asset.status === "ready" && asset.kind === "video"
                  ? <video src={`/api/files/assets/${asset.id}`} controls preload="metadata" />
                  : <div className="asset-preview-placeholder">
                    <strong>{asset.kind === "psd" ? "PSD" : asset.status === "processing" ? "変換中" : "!"}</strong>
                    <small>{asset.kind === "psd" ? "立ち絵素材" : asset.error ?? asset.status}</small>
                  </div>}
            </div>
            <div className="asset-card-info">
              <div><strong title={asset.originalName}>{asset.originalName}</strong>
                <small>{assetKindLabel(asset.kind)} · {assetStatusLabel(asset.status)}</small></div>
              <button className="icon danger" title="素材を削除" disabled={asset.status === "processing" || deletingId === asset.id}
                onClick={() => void removeAsset(asset)}>{deletingId === asset.id ? "…" : "×"}</button>
            </div>
          </article>
        ))}</div>
      </div>
    </details>
  );
}

const assetKindLabel = (kind: AssetRow["kind"]) => ({image: "画像", video: "動画", psd: "PSD"})[kind];
const assetStatusLabel = (status: string) => ({ready: "利用可能", processing: "変換中", error: "エラー"})[status] ?? status;

function GeminiButton({onGenerate}: {onGenerate: (memo: string) => Promise<void>}) {
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [state, setState] = useState("");
  const run = async () => {
    setState("生成中…");
    try {
      await onGenerate(memo);
      setMemo("");
      setOpen(false);
      setState("");
    } catch (error) {
      setState(error instanceof Error ? error.message : "生成に失敗しました");
    }
  };
  if (!open) return <button className="gemini-button" onClick={() => setOpen(true)}>✦ メモから会話を追加</button>;
  return (
    <div className="gemini-box">
      <textarea autoFocus placeholder="今日やったことをざっくり入力" value={memo} onChange={(event) => setMemo(event.target.value)} />
      <button className="primary" disabled={!memo || state === "生成中…"} onClick={run}>追加</button>
      <button className="secondary" onClick={() => setOpen(false)}>閉じる</button>
      {state ? <span>{state}</span> : null}
    </div>
  );
}
