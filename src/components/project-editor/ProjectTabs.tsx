"use client";

import type { RefObject } from "react";
import type { DiaryEntry } from "@/domain/types";
import type { EditorTab } from "./types";

type Props = {
  activeTab: EditorTab;
  diaries: DiaryEntry[];
  tabsRef: RefObject<HTMLDivElement | null>;
  onSelect: (tab: EditorTab) => void;
  onSortDiaries: () => void;
  onAddDiary: () => void;
};

export function ProjectTabs({ activeTab, diaries, tabsRef, onSelect, onSortDiaries, onAddDiary }: Props) {
  return (
    <div className="editor-tabs-toolbar">
      <div ref={tabsRef} className="editor-tabs" role="tablist" aria-label="プロジェクトの編集項目">
        <button
          id="tab-general"
          role="tab"
          aria-selected={activeTab === "general"}
          aria-controls="panel-general"
          className={activeTab === "general" ? "active" : ""}
          onClick={() => onSelect("general")}
        >
          <span>一般設定</span>
        </button>
        <button
          id="tab-thumbnail"
          role="tab"
          aria-selected={activeTab === "thumbnail"}
          aria-controls="panel-thumbnail"
          className={activeTab === "thumbnail" ? "active" : ""}
          onClick={() => onSelect("thumbnail")}
        >
          <span>サムネイル</span>
        </button>
        <button
          id="tab-wish"
          role="tab"
          aria-selected={activeTab === "wish"}
          aria-controls="panel-wish"
          className={activeTab === "wish" ? "active" : ""}
          onClick={() => onSelect("wish")}
        >
          <span>今作りたいもの</span>
        </button>
        {diaries.map((diary, diaryIndex) => {
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
              onClick={() => onSelect(tabId)}
            >
              <small>{String(diaryIndex + 1).padStart(2, "0")}</small>
              <span>{diary.date || "日付未設定"}</span>
            </button>
          );
        })}
      </div>
      <div className="editor-tab-actions">
        {diaries.length > 1 ? (
          <button className="secondary sort-diaries" onClick={onSortDiaries}>
            日付順
          </button>
        ) : null}
        <button className="primary add-diary-tab" onClick={onAddDiary}>
          ＋ 日誌を追加
        </button>
      </div>
    </div>
  );
}
