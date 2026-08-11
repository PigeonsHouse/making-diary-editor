"use client";

import { useState } from "react";
import type { Character, Dialogue } from "@/domain/types";
import { VoiceSettingsSliders } from "../VoiceSettingsSliders";
import { useVoicevoxSpeakers } from "../useVoicevoxSpeakers";

type Props = {
  character: Character;
  dialogue: Dialogue;
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
};

export function DialogueVoiceOverrides({ character, dialogue, updateDialogue }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { speakers, error, loading, retry } = useVoicevoxSpeakers(isOpen);
  const styles = speakers.find((speaker) => speaker.name === character.voicevoxName)?.styles ?? [];
  const overrideCount = Object.keys(dialogue.voiceOverrides).length;
  return (
    <details className="dialogue-voice-options" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        音声パラメータの上書き <small>{overrideCount}件</small>
      </summary>
      {isOpen ? (
        <>
          <div className="dialogue-voice-fields">
            <label>
              スタイル
              <select
                value={dialogue.voiceOverrides.styleName ?? ""}
                disabled={loading}
                onChange={(event) =>
                  updateDialogue((draft) => {
                    if (event.target.value === "") delete draft.voiceOverrides.styleName;
                    else draft.voiceOverrides.styleName = event.target.value;
                  })
                }
              >
                <option value="">既定: {character.voice.styleName}</option>
                {styles.map((style) => (
                  <option key={style.name} value={style.name}>
                    {style.name}
                  </option>
                ))}
              </select>
            </label>
            {loading ? <small>スタイルを取得中…</small> : null}
            {error ? (
              <div className="dialogue-voice-load-error">
                <small>{error}</small>
                <button type="button" className="secondary" onClick={retry}>
                  再読み込み
                </button>
              </div>
            ) : null}
          </div>
          <VoiceSettingsSliders
            allowUnset
            values={dialogue.voiceOverrides}
            defaults={character.voice}
            onChange={(key, value) =>
              updateDialogue((draft) => {
                if (value === undefined) delete draft.voiceOverrides[key];
                else draft.voiceOverrides[key] = value;
              })
            }
          />
        </>
      ) : null}
    </details>
  );
}
