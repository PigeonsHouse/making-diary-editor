"use client";

import { useEffect, useState } from "react";
import type { Character, Dialogue } from "@/domain/types";

type Props = {
  character: Character;
  dialogue: Dialogue;
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
};

export function DialoguePsdOverrides({ character, dialogue, updateDialogue }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(character.avatar.previewUrl);
  const [previewState, setPreviewState] = useState("");
  const selections = { ...character.psdDefaults, ...dialogue.psdOverrides };
  const previewSignature = JSON.stringify({ filters: character.psdFilters, selections });

  useEffect(() => {
    if (!isOpen || !character.psdAssetId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewState("プレビュー生成中…");
      try {
        const response = await fetch(`/api/psd/${character.psdAssetId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
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

  const filterNames = (
    character.psdFilterOrder.length ? character.psdFilterOrder : Object.keys(character.psdFilters)
  ).filter((filterName) => character.psdFilters[filterName]);

  return (
    <details className="dialogue-psd-options" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        立ち絵の上書き <small>{Object.keys(dialogue.psdOverrides).length}件</small>
      </summary>
      {isOpen ? (
        <div className="dialogue-psd-body">
          <div className="dialogue-psd-preview">
            {previewUrl ? <img src={previewUrl} alt="このセリフの立ち絵プレビュー" /> : <span>プレビュー未生成</span>}
            {previewState ? <small>{previewState}</small> : null}
          </div>
          <div className="dialogue-psd-fields">
            {filterNames.map((filterName) => {
              const filter = character.psdFilters[filterName];
              return (
                <label key={filterName}>
                  {filterName}
                  <select
                    value={dialogue.psdOverrides[filterName] ?? ""}
                    onChange={(event) =>
                      updateDialogue((draft) => {
                        if (event.target.value) draft.psdOverrides[filterName] = event.target.value;
                        else delete draft.psdOverrides[filterName];
                      })
                    }
                  >
                    <option value="">既定: {character.psdDefaults[filterName] ?? "未指定"}</option>
                    {(filter.choiceOrder.length ? filter.choiceOrder : Object.keys(filter.choices))
                      .filter((choice) => filter.choices[choice])
                      .map((choice) => (
                        <option key={choice}>{choice}</option>
                      ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </details>
  );
}
