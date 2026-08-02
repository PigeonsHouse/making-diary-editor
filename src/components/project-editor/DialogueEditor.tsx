"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Character, Dialogue } from "@/domain/types";
import { DialoguePsdOverrides } from "./DialoguePsdOverrides";
import { DialogueVoiceOverrides } from "./DialogueVoiceOverrides";
import { DIALOGUE_DRAG_TYPE, hasDialogueDragData, readDialogueDragData } from "./dialogue-dnd";
import type { DialogueDragLocation } from "./types";

type Props = {
  dialogue: Dialogue;
  index: number;
  characters: Character[];
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
  remove: () => void;
  dragLocation?: DialogueDragLocation;
  onDropDialogue?: (from: DialogueDragLocation, toDialogueIndex: number) => void;
};

export function DialogueEditor({
  dialogue,
  index,
  characters,
  updateDialogue,
  remove,
  dragLocation,
  onDropDialogue,
}: Props) {
  const character = characters.find((item) => item.id === dialogue.characterId) ?? characters[0];
  const [kanaOpen, setKanaOpen] = useState(dialogue.kana !== null);
  const [kanaState, setKanaState] = useState("");
  const initialSignature = useRef("__generate__");
  const updateDialogueRef = useRef(updateDialogue);
  updateDialogueRef.current = updateDialogue;

  useEffect(() => {
    if (!character) return;
    const voice = { ...character.voice, ...dialogue.voiceOverrides };
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
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const result = await response.json();
        if (cancelled) return;
        initialSignature.current = signature;
        if (dialogue.audio.status === "ready" && dialogue.audio.inputHash === result.hash) return;
        updateDialogueRef.current((draft) => {
          draft.audio.status = "generating";
        });
        const audio = new window.Audio(result.url);
        audio.addEventListener(
          "loadedmetadata",
          () => {
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
          },
          { once: true },
        );
        audio.addEventListener(
          "error",
          () => {
            if (cancelled) return;
            updateDialogueRef.current((draft) => {
              draft.audio.status = "error";
              draft.audio.error = "生成音声を読み込めませんでした";
            });
          },
          { once: true },
        );
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: dialogue.text,
          voicevoxName: character.voicevoxName,
          styleName: dialogue.voiceOverrides.styleName ?? character.voice.styleName,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "kanaを取得できませんでした");
      updateDialogue((draft) => {
        draft.kana = result.kana;
      });
      setKanaOpen(true);
      setKanaState("");
    } catch (error) {
      setKanaState(error instanceof Error ? error.message : "kanaを取得できませんでした");
    }
  };

  return (
    <div
      className="dialogue-row"
      style={{ "--speaker": character?.color ?? "#64748b" } as CSSProperties}
      onDragOver={(event) => {
        if (dragLocation && hasDialogueDragData(event.dataTransfer)) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!dragLocation || !onDropDialogue) return;
        const from = readDialogueDragData(event.dataTransfer, dragLocation.diaryId);
        if (!from) return;
        event.preventDefault();
        const after =
          event.clientY >= event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2;
        onDropDialogue(from, index + (after ? 1 : 0));
      }}
    >
      <div
        className={`dialogue-index ${dragLocation ? "draggable" : ""}`}
        title={dragLocation ? "ドラッグしてセリフを移動" : undefined}
        draggable={Boolean(dragLocation)}
        onDragStart={(event) => {
          if (!dragLocation) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(DIALOGUE_DRAG_TYPE, JSON.stringify(dragLocation));
        }}
      >
        {index + 1}
      </div>
      <select
        value={dialogue.characterId}
        onChange={(event) =>
          updateDialogue((draft) => {
            draft.characterId = event.target.value;
          })
        }
      >
        {characters.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <label className="pause-field">
        手前の余白
        <input
          type="number"
          step="0.1"
          placeholder="既定"
          value={dialogue.pauseBeforeSeconds ?? ""}
          onChange={(event) =>
            updateDialogue((draft) => {
              draft.pauseBeforeSeconds = event.target.value === "" ? null : Number(event.target.value);
            })
          }
        />
      </label>
      <textarea
        value={dialogue.text}
        onChange={(event) =>
          updateDialogue((draft) => {
            draft.text = event.target.value;
          })
        }
      />
      <div className={`audio-status ${dialogue.audio.status}`} title={dialogue.audio.error ?? undefined}>
        {dialogue.audio.status === "ready" && dialogue.audio.url ? (
          <button onClick={() => new window.Audio(dialogue.audio.url!).play()}>▶</button>
        ) : dialogue.audio.status === "generating" ? (
          "生成中"
        ) : dialogue.audio.status === "error" ? (
          "!"
        ) : (
          "○"
        )}
      </div>
      <button className="icon danger" onClick={remove}>
        ×
      </button>
      {dialogue.kana === null ? (
        <div className="dialogue-kana-options dialogue-kana-empty">
          <span>読み：本文を使用</span>
          <button
            className="secondary"
            disabled={!dialogue.text || kanaState === "取得中…"}
            onClick={() => void loadDefaultKana()}
          >
            VOICEVOXからkanaを読み込む
          </button>
          {kanaState ? <small className={kanaState === "取得中…" ? "" : "error"}>{kanaState}</small> : null}
        </div>
      ) : (
        <details
          className="dialogue-kana-options"
          open={kanaOpen}
          onToggle={(event) => setKanaOpen(event.currentTarget.open)}
        >
          <summary>
            <span>読み（AquesTalk風kana）</span>
            <small>指定あり</small>
          </summary>
          {kanaOpen ? (
            <>
              <textarea
                aria-label="AquesTalk風kana"
                value={dialogue.kana}
                onChange={(event) =>
                  updateDialogue((draft) => {
                    draft.kana = event.target.value;
                  })
                }
              />
              <div className="dialogue-kana-actions">
                <button
                  className="secondary"
                  disabled={kanaState === "取得中…"}
                  onClick={() => {
                    if (
                      window.confirm("現在のkanaが消えて、VOICEVOXから取得した値で上書きされます。再取得しますか？")
                    ) {
                      void loadDefaultKana();
                    }
                  }}
                >
                  kanaリセット
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    if (window.confirm("現在のkanaを削除してnullに戻します。読み調整は元に戻せません。続けますか？")) {
                      updateDialogue((draft) => {
                        draft.kana = null;
                      });
                      setKanaOpen(false);
                      setKanaState("");
                    }
                  }}
                >
                  nullに戻す
                </button>
                {kanaState ? <small className={kanaState === "取得中…" ? "" : "error"}>{kanaState}</small> : null}
              </div>
            </>
          ) : null}
        </details>
      )}
      {dialogue.audio.status === "error" && dialogue.audio.error ? (
        <div className="dialogue-audio-error" role="alert">
          {dialogue.audio.error}
        </div>
      ) : null}
      {character ? (
        <DialogueVoiceOverrides character={character} dialogue={dialogue} updateDialogue={updateDialogue} />
      ) : null}
      {character && Object.keys(character.psdFilters).length > 0 ? (
        <DialoguePsdOverrides character={character} dialogue={dialogue} updateDialogue={updateDialogue} />
      ) : null}
    </div>
  );
}
