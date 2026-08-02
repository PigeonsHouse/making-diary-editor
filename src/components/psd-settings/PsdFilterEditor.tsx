"use client";

import { useState } from "react";
import { PathPicker } from "./PsdTreePicker";
import type { PsdFilter, TreeNode } from "./types";
import { choiceNames, uniqueName } from "./utils";

type Props = {
  name: string;
  filter: PsdFilter;
  tree: TreeNode[];
  defaultChoice: string;
  sourceFolders: string[];
  setSourceFolders: (paths: string[]) => void;
  onAddSourceLayers: () => void;
  onChange: (filter: PsdFilter) => void;
  onDefaultChange: (choice: string) => void;
  onDelete: () => void;
};

export function PsdFilterEditor({
  name,
  filter,
  tree,
  defaultChoice,
  sourceFolders,
  setSourceFolders,
  onAddSourceLayers,
  onChange,
  onDefaultChange,
  onDelete,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const addEmptyChoice = () => {
    const requested = window.prompt("選択肢名", "新規")?.trim();
    if (!requested) return;
    const choiceName = uniqueName(requested, Object.keys(filter.choices));
    onChange({
      ...filter,
      choiceOrder: [...choiceNames(filter, tree), choiceName],
      choices: { ...filter.choices, [choiceName]: { show: [] } },
    });
  };

  return (
    <details className="psd-filter-editor" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <strong>{name}</strong>
        <label className="psd-summary-default" onClick={(event) => event.stopPropagation()}>
          既定
          <select value={defaultChoice} onChange={(event) => onDefaultChange(event.target.value)}>
            <option value="">未指定</option>
            {choiceNames(filter, tree).map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        </label>
        <small>{Object.keys(filter.choices).length}選択肢</small>
        <button
          className="psd-category-delete"
          title="カテゴリを削除"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      </summary>
      {isOpen ? (
        <div className="psd-filter-body">
          <div className="psd-filter-toolbar">
            <button className="secondary" onClick={addEmptyChoice}>
              ＋ 空の選択肢
            </button>
          </div>
          <PathPicker
            label="表示制御の対象"
            tree={tree}
            selected={filter.targets}
            selectable="all"
            onChange={(targets) => onChange({ ...filter, targets })}
          />
          <PathPicker
            label="選択肢追加元フォルダ"
            tree={tree}
            selected={sourceFolders}
            selectable="group"
            onChange={setSourceFolders}
            action={
              <button className="secondary psd-add-layers" onClick={onAddSourceLayers}>
                直下の単レイヤを選択肢へ一括追加
              </button>
            }
          />
          {choiceNames(filter, tree).map((choiceName) => (
            <ChoiceEditor
              key={choiceName}
              name={choiceName}
              choice={filter.choices[choiceName]}
              tree={tree}
              onChange={(next) => onChange({ ...filter, choices: { ...filter.choices, [choiceName]: next } })}
              onDelete={() => {
                const choices = { ...filter.choices };
                delete choices[choiceName];
                onChange({
                  ...filter,
                  choices,
                  choiceOrder: choiceNames(filter, tree).filter((name) => name !== choiceName),
                });
              }}
              onRename={(requestedName) => {
                const otherNames = Object.keys(filter.choices).filter((name) => name !== choiceName);
                const renamedName = uniqueName(requestedName, otherNames);
                const choices = { ...filter.choices };
                delete choices[choiceName];
                choices[renamedName] = filter.choices[choiceName];
                onChange({
                  ...filter,
                  choices,
                  choiceOrder: choiceNames(filter, tree).map((name) => (name === choiceName ? renamedName : name)),
                });
                if (defaultChoice === choiceName) onDefaultChange(renamedName);
              }}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function ChoiceEditor({
  name,
  choice,
  tree,
  onChange,
  onDelete,
  onRename,
}: {
  name: string;
  choice: { show: string[]; hide?: string[] };
  tree: TreeNode[];
  onChange: (choice: { show: string[]; hide?: string[] }) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="psd-choice-card" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <strong>{name}</strong>
        <small>
          {choice.show.length} ON / {(choice.hide ?? []).length} OFF
        </small>
        <button
          className="psd-choice-rename"
          title="選択肢名を変更"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const nextName = window.prompt("選択肢名", name)?.trim();
            if (nextName && nextName !== name) onRename(nextName);
          }}
        >
          ✎
        </button>
        <button
          className="psd-choice-delete"
          title="選択肢を削除"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      </summary>
      {isOpen ? (
        <div className="psd-choice-body">
          <PathPicker
            label="この選択肢でONにするレイヤー"
            tree={tree}
            selected={choice.show}
            selectable="all"
            onChange={(show) => onChange({ ...choice, show })}
          />
          <PathPicker
            label="この選択肢でOFFにするレイヤー"
            tree={tree}
            selected={choice.hide ?? []}
            selectable="all"
            onChange={(hide) => onChange({ ...choice, hide })}
          />
        </div>
      ) : null}
    </details>
  );
}
