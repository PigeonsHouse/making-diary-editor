"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBlock, createDialogue, createDiary } from "@/domain/defaults";
import { validateProject } from "@/domain/timeline";
import type { Character, ProjectDocument, ProjectRecord } from "@/domain/types";
import { VideoPreview } from "./VideoPreview";
import { AssetLibrary } from "./project-editor/AssetLibrary";
import { CastEditor } from "./project-editor/CastEditor";
import { DiaryPanel } from "./project-editor/DiaryPanel";
import { ProjectTabs } from "./project-editor/ProjectTabs";
import { WishEditor } from "./project-editor/WishEditor";
import { cleanLegacyVoiceOverrides } from "./project-editor/project-document";
import { getPreviewProject } from "./project-editor/preview-project";
import type { AssetRow, CharacterRow, EditorTab } from "./project-editor/types";

export function ProjectEditor({ projectId }: { projectId: string }) {
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
    ])
      .then(([project, characterRows, assetRows]: [ProjectRecord, CharacterRow[], AssetRow[]]) => {
        const cleanedLegacyOverrides = cleanLegacyVoiceOverrides(project.document);
        setRecord({ ...project, document: cleanedLegacyOverrides.document });
        setCharacters(characterRows.map((row) => row.data));
        setAssets(assetRows);
        setSaveState(cleanedLegacyOverrides.changed ? "未保存" : "保存済み");
        skipSave.current = !cleanedLegacyOverrides.changed;
      })
      .catch(() => setSaveState("読み込み失敗"));
  }, [projectId]);

  const update = useCallback((recipe: (draft: ProjectDocument) => void) => {
    setRecord((current) => {
      if (!current) return current;
      const document = structuredClone(current.document);
      recipe(document);
      return { ...current, document };
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision: record.revision, document: record.document }),
      });
      if (response.status === 409) return setSaveState("競合：再読み込みしてください");
      if (!response.ok) return setSaveState("保存失敗");
      skipSave.current = true;
      setRecord(await response.json());
      setSaveState("保存済み");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [record, projectId]);

  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab, record?.document.diaries.length]);

  if (!record) {
    return (
      <div className="page">
        <div className="empty-state">{saveState}</div>
      </div>
    );
  }

  const project = record.document;
  const previewProject = getPreviewProject(project, activeTab);
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
  ) =>
    update((draft) => {
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const body = await response.json();
    if (!response.ok) return setRenderState(body.error ?? "開始できませんでした");
    setRenderState("待機中 0%");
    const events = new EventSource(`/api/render/${body.id}/events`);
    events.onmessage = (event) => {
      const job = JSON.parse(event.data);
      setRenderState(
        job.status === "completed"
          ? "完成しました"
          : job.status === "failed"
            ? `失敗: ${job.error}`
            : `${job.status === "queued" ? "待機中" : "レンダリング中"} ${job.progress}%`,
      );
      if (["completed", "failed", "missing"].includes(job.status)) events.close();
    };
  };
  const generateDialogues = async (diaryId: string, memo: string) => {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        memo,
        characters: project.characterIds
          .map((id) => characters.find((item) => item.id === id))
          .filter(Boolean)
          .map((item) => ({ id: item!.id, name: item!.name, personality: item!.personality })),
      }),
    });
    if (!response.ok) throw new Error((await response.json()).error);
    const generated: Array<{ characterId: string; text: string }> = await response.json();
    update((draft) => {
      const diary = draft.diaries.find((item) => item.id === diaryId)!;
      const block = createBlock();
      block.durationSeconds = null;
      block.dialogues = generated.map((item) => ({ ...createDialogue(item.characterId), text: item.text }));
      diary.blocks.push(block);
    });
  };

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <input
          className="title-input"
          value={project.name}
          onChange={(event) =>
            update((draft) => {
              draft.name = event.target.value;
            })
          }
        />
        <div className={`save-state ${saveState.includes("失敗") || saveState.includes("競合") ? "bad" : ""}`}>
          <span />
          {saveState}
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
          <ProjectTabs
            activeTab={activeTab}
            diaries={project.diaries}
            tabsRef={tabsRef}
            onSelect={setActiveTab}
            onSortDiaries={sortDiaries}
            onAddDiary={addDiary}
          />
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
          {project.diaries.map((diary, diaryIndex) =>
            activeTab === `diary:${diary.id}` ? (
              <DiaryPanel
                key={diary.id}
                diary={diary}
                diaryIndex={diaryIndex}
                project={project}
                characters={characters}
                assets={assets}
                update={update}
                onAssetsChanged={setAssets}
                onRemove={() => removeDiary(diaryIndex)}
                onGenerateDialogues={(memo) => generateDialogues(diary.id, memo)}
                moveDialogue={moveDiaryDialogue}
              />
            ) : null,
          )}
        </section>
        <aside className="preview-column">
          <VideoPreview key={activeTab} project={previewProject} characters={characters} />
          <div className="preview-meta">
            <span>1920 × 1080</span>
            <span>30 FPS</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
