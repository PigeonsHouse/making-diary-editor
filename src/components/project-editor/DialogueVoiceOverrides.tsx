"use client";

import {useState} from "react";
import type {Character, Dialogue} from "@/domain/types";
import {VoiceSettingsSliders} from "../VoiceSettingsSliders";

type Props = {
  character: Character;
  dialogue: Dialogue;
  updateDialogue: (recipe: (draft: Dialogue) => void) => void;
};

export function DialogueVoiceOverrides({character, dialogue, updateDialogue}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="dialogue-voice-options" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>音声パラメータの上書き</summary>
      {isOpen ? (
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
      ) : null}
    </details>
  );
}
