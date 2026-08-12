"use client";

import { useState } from "react";
import { VoiceSettingsSliders } from "@/components/VoiceSettingsSliders";
import type { Character, SupportNarration } from "@/domain/types";
import { invalidateAudio } from "./utils";

export function SupportVoiceRow({
  narration,
  character,
  label,
  index,
  generationState,
  updateDialogue,
}: {
  narration: SupportNarration;
  character: Character;
  label: string;
  index: number;
  generationState: "waiting" | "generating" | null;
  updateDialogue: (recipe: (dialogue: SupportNarration) => void) => void;
}) {
  const [kanaState, setKanaState] = useState("");
  const changeAudioInput = (recipe: (dialogue: SupportNarration) => void) =>
    updateDialogue((dialogue) => {
      recipe(dialogue);
      invalidateAudio(dialogue);
    });
  const loadKana = async () => {
    setKanaState("取得中…");
    try {
      const response = await fetch("/api/voice/kana", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: narration.text,
          voicevoxName: character.voicevoxName,
          styleName: narration.voiceOverrides.styleName ?? character.voice.styleName,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "kanaを取得できませんでした");
      changeAudioInput((dialogue) => {
        dialogue.kana = result.kana;
      });
      setKanaState("");
    } catch (error) {
      setKanaState(error instanceof Error ? error.message : "kanaを取得できませんでした");
    }
  };
  const status =
    generationState === "generating"
      ? "生成中"
      : generationState === "waiting"
        ? "待機中"
        : narration.audio.status === "ready"
          ? "生成済み"
          : narration.audio.status === "error"
            ? "失敗"
            : "待機中";
  const displayedAudioStatus = generationState ?? narration.audio.status;
  return (
    <details className="support-voice-row">
      <summary>
        <span className="support-voice-index">{index + 1}</span>
        <small>{label}</small>
        <strong>{narration.text}</strong>
        <span className={`support-voice-status ${displayedAudioStatus}`}>{status}</span>
      </summary>
      <div className="support-voice-body">
        <div className="support-voice-actions">
          {narration.audio.url ? (
            <button className="secondary" onClick={() => new window.Audio(narration.audio.url!).play()}>
              ▶ 試聴
            </button>
          ) : null}
          {narration.audio.status === "error" ? (
            <button className="secondary" onClick={() => updateDialogue(invalidateAudio)}>
              再試行
            </button>
          ) : null}
          <button className="secondary" disabled={kanaState === "取得中…"} onClick={() => void loadKana()}>
            VOICEVOXからkanaを読み込む
          </button>
          {narration.kana !== null ? (
            <button
              className="secondary"
              onClick={() =>
                changeAudioInput((dialogue) => {
                  dialogue.kana = null;
                })
              }
            >
              kanaを使用しない
            </button>
          ) : null}
        </div>
        {narration.kana !== null ? (
          <label>
            <span>読み（AquesTalk風kana）</span>
            <textarea
              value={narration.kana}
              onChange={(event) =>
                changeAudioInput((dialogue) => {
                  dialogue.kana = event.target.value;
                })
              }
            />
          </label>
        ) : null}
        {kanaState ? <small className={kanaState === "取得中…" ? "" : "error"}>{kanaState}</small> : null}
        {narration.audio.error ? <div className="support-error">{narration.audio.error}</div> : null}
        <label className="support-pause-field">
          <span>手前の余白（秒）</span>
          <input
            type="number"
            step="0.1"
            placeholder="キャラクター既定"
            value={narration.pauseBeforeSeconds ?? ""}
            onChange={(event) =>
              updateDialogue((dialogue) => {
                dialogue.pauseBeforeSeconds = event.target.value === "" ? null : Number(event.target.value);
              })
            }
          />
        </label>
        <details className="support-voice-overrides">
          <summary>音声パラメータの上書き</summary>
          <VoiceSettingsSliders
            allowUnset
            values={narration.voiceOverrides}
            defaults={character.voice}
            onChange={(key, value) =>
              changeAudioInput((dialogue) => {
                if (value === undefined) delete dialogue.voiceOverrides[key];
                else dialogue.voiceOverrides[key] = value;
              })
            }
          />
        </details>
      </div>
    </details>
  );
}
