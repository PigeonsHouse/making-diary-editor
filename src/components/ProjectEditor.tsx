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

export function ProjectEditor({projectId}: {projectId: string}) {
  const [record, setRecord] = useState<ProjectRecord | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [saveState, setSaveState] = useState("読み込み中");
  const [renderState, setRenderState] = useState("");
  const [selectedDiaryId, setSelectedDiaryId] = useState<string | null>(null);
  const skipSave = useRef(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((response) => response.json()),
      fetch("/api/characters").then((response) => response.json()),
      fetch("/api/assets").then((response) => response.json()),
    ]).then(([project, characterRows, assetRows]: [ProjectRecord, CharacterRow[], AssetRow[]]) => {
      setRecord(project);
      setCharacters(characterRows.map((row) => row.data));
      setAssets(assetRows);
      setSaveState("保存済み");
      skipSave.current = true;
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

  if (!record) return <div className="page"><div className="empty-state">{saveState}</div></div>;
  const project = record.document;
  const issues = validateProject(project, characters);

  const addDiary = () => {
    const diary = createDiary();
    update((draft) => draft.diaries.push(diary));
    setSelectedDiaryId(diary.id);
  };
  const sortDiaries = () => update((draft) => draft.diaries.sort((a, b) => a.date.localeCompare(b.date)));
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
        <button className="secondary" onClick={sortDiaries}>日付順に並べる</button>
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
          <CastEditor project={project} characters={characters} update={update} />
          <AssetLibrary assets={assets} onChanged={setAssets} />
          <WishEditor project={project} characters={characters} update={update} />
          <div className="section-heading">
            <div><p className="eyebrow">DIARY</p><h2>日誌</h2></div>
            <button className="secondary" onClick={addDiary}>＋ 日誌を追加</button>
          </div>
          {project.diaries.map((diary, diaryIndex) => (
            <article
              className={`diary-card ${selectedDiaryId === diary.id ? "selected" : ""}`}
              key={diary.id}
              onClick={() => setSelectedDiaryId(diary.id)}
            >
              <div className="diary-heading">
                <span className="order-badge">{String(diaryIndex + 1).padStart(2, "0")}</span>
                <input type="date" value={diary.date} onChange={(event) => update((draft) => {
                  draft.diaries[diaryIndex].date = event.target.value;
                })} />
                <input
                  className="grow"
                  placeholder="その日の概要"
                  value={diary.subtitle}
                  onChange={(event) => update((draft) => {
                    draft.diaries[diaryIndex].subtitle = event.target.value;
                  })}
                />
                <button className="icon danger" onClick={() => update((draft) => {
                  draft.diaries.splice(diaryIndex, 1);
                })}>×</button>
              </div>
              {diary.blocks.map((block, blockIndex) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  characters={characters}
                  projectCharacterIds={project.characterIds}
                  assets={assets}
                  updateBlock={(recipe) => update((draft) => {
                    recipe(draft.diaries[diaryIndex].blocks[blockIndex]);
                  })}
                  remove={() => update((draft) => draft.diaries[diaryIndex].blocks.splice(blockIndex, 1))}
                />
              ))}
              <div className="diary-actions">
                <button className="secondary" onClick={() => update((draft) => {
                  draft.diaries[diaryIndex].blocks.push(createBlock());
                })}>＋ コンテンツ</button>
                <GeminiButton onGenerate={(memo) => generateDialogues(diary.id, memo)} />
              </div>
            </article>
          ))}
          {project.diaries.length === 0 ? <div className="empty-state">日誌を追加してください。</div> : null}
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
              <button onClick={() => update((draft) => draft.characterIds.splice(index, 1))}>×</button>
            </div>
          );
        })}
        {available.length ? (
          <select value="" onChange={(event) => update((draft) => draft.characterIds.push(event.target.value))}>
            <option value="">＋ 追加</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        ) : null}
      </div>
      <div className="field-grid compact">
        <label>立ち絵の覗き量px<input type="number" value={project.avatarLayout.peekOffsetPx} onChange={(event) =>
          update((draft) => { draft.avatarLayout.peekOffsetPx = Number(event.target.value); })
        } /></label>
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
      draft.wishList = {markdown: "- 作りたいもの", dialogues: [], durationSeconds: null};
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
        <button className="add-dialogue" disabled={cast.length === 0} onClick={() => update((draft) => {
          draft.wishList!.durationSeconds = null;
          draft.wishList!.dialogues.push(createDialogue(cast[0].id));
        })}>＋ 作りたいもののセリフを追加</button>
      </div>
    </section>
  );
}

function BlockEditor({block, characters, projectCharacterIds, assets, updateBlock, remove}: {
  block: ContentBlock;
  characters: Character[];
  projectCharacterIds: string[];
  assets: AssetRow[];
  updateBlock: (recipe: (draft: ContentBlock) => void) => void;
  remove: () => void;
}) {
  const cast = projectCharacterIds.map((id) => characters.find((item) => item.id === id)).filter(Boolean) as Character[];
  return (
    <section className="block-card">
      <div className="block-heading">
        <span className="drag-handle">⠿</span>
        <input placeholder="コンテンツ名（任意）" value={block.title} onChange={(event) =>
          updateBlock((draft) => { draft.title = event.target.value; })
        } />
        <label className="inline-field">末尾
          <input type="number" step="0.1" placeholder="既定" value={block.endHoldSeconds ?? ""} onChange={(event) =>
            updateBlock((draft) => { draft.endHoldSeconds = event.target.value === "" ? null : Number(event.target.value); })
          } /> 秒
        </label>
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
      <button className="add-dialogue" disabled={cast.length === 0} onClick={() => updateBlock((draft) => {
        draft.durationSeconds = null;
        draft.dialogues.push(createDialogue(cast[0].id));
      })}>＋ セリフを追加</button>
    </section>
  );
}

function DialogueEditor({dialogue, index, characters, updateDialogue, remove}: {
  dialogue: Dialogue;
  index: number;
  characters: Character[];
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
  remove: () => void;
}) {
  const character = characters.find((item) => item.id === dialogue.characterId) ?? characters[0];
  const initialSignature = useRef(dialogue.audio.status === "ready"
    ? JSON.stringify([dialogue.text, dialogue.kana, dialogue.characterId, dialogue.voiceOverrides])
    : "__generate__");
  useEffect(() => {
    const signature = JSON.stringify([dialogue.text, dialogue.kana, dialogue.characterId, dialogue.voiceOverrides]);
    if (signature === initialSignature.current || !character) return;
    const timer = window.setTimeout(async () => {
      updateDialogue((draft) => { draft.audio.status = "generating"; });
      try {
        const voice = {...character.voice, ...dialogue.voiceOverrides};
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({...voice, voicevoxName: character.voicevoxName, text: dialogue.text, kana: dialogue.kana}),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const result = await response.json();
        const audio = new window.Audio(result.url);
        audio.addEventListener("loadedmetadata", () => updateDialogue((draft) => {
          draft.audio = {
            status: "ready",
            url: result.url,
            durationSeconds: audio.duration,
            error: null,
            inputHash: result.hash,
          };
        }), {once: true});
        initialSignature.current = signature;
      } catch (error) {
        updateDialogue((draft) => {
          draft.audio.status = "error";
          draft.audio.error = error instanceof Error ? error.message : "音声生成に失敗しました";
        });
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [dialogue.text, dialogue.kana, dialogue.characterId, dialogue.voiceOverrides, character, updateDialogue]);

  return (
    <div className="dialogue-row" style={{"--speaker": character?.color ?? "#64748b"} as React.CSSProperties}>
      <div className="dialogue-index">{index + 1}</div>
      <select value={dialogue.characterId} onChange={(event) => updateDialogue((draft) => {
        draft.characterId = event.target.value;
      })}>
        {characters.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
      <textarea value={dialogue.text} onChange={(event) => updateDialogue((draft) => {
        draft.text = event.target.value;
      })} />
      <label className="pause-field">余白
        <input type="number" step="0.1" placeholder="既定" value={dialogue.pauseBeforeSeconds ?? ""} onChange={(event) =>
          updateDialogue((draft) => { draft.pauseBeforeSeconds = event.target.value === "" ? null : Number(event.target.value); })
        } />
      </label>
      <div className={`audio-status ${dialogue.audio.status}`}>
        {dialogue.audio.status === "ready" && dialogue.audio.url ? (
          <button onClick={() => new window.Audio(dialogue.audio.url!).play()}>▶</button>
        ) : dialogue.audio.status === "generating" ? "生成中" : dialogue.audio.status === "error" ? "!" : "○"}
      </div>
      <button className="icon danger" onClick={remove}>×</button>
      {character && Object.keys(character.psdFilters).length > 0 ? (
        <div className="dialogue-psd-options">
          {(character.psdFilterOrder.length ? character.psdFilterOrder : Object.keys(character.psdFilters))
            .filter((filterName) => character.psdFilters[filterName])
            .map((filterName) => {
            const filter = character.psdFilters[filterName]; return (
            <label key={filterName}>{filterName}
              <select value={dialogue.psdOverrides[filterName] ?? ""} onChange={(event) => updateDialogue((draft) => {
                if (event.target.value) draft.psdOverrides[filterName] = event.target.value;
                else delete draft.psdOverrides[filterName];
              })}>
                <option value="">既定: {character.psdDefaults[filterName] ?? "未指定"}</option>
                {(filter.choiceOrder.length ? filter.choiceOrder : Object.keys(filter.choices))
                  .filter((choice) => filter.choices[choice])
                  .map((choice) => <option key={choice}>{choice}</option>)}
              </select>
            </label>
          );})}
        </div>
      ) : null}
      {character ? <DialogueVoiceOverrides character={character} dialogue={dialogue} updateDialogue={updateDialogue} /> : null}
    </div>
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
    } else setUploading(false);
  };
  return (
    <details className="panel">
      <summary><span>素材</span><small>{assets.length}件</small></summary>
      <div className="asset-library">
        <label className="secondary upload-button">
          {uploading ? "変換中…" : "＋ 画像・動画をアップロード"}
          <input type="file" accept="image/*,video/*,.psd" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
        {assets.map((asset) => (
          <span className={`asset-pill ${asset.status}`} key={asset.id}>
            {asset.originalName} · {asset.status}
          </span>
        ))}
      </div>
    </details>
  );
}

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
