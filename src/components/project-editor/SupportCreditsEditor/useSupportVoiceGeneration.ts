"use client";

import { useEffect, useRef, useState } from "react";
import type { Character, SupportNarration } from "@/domain/types";
import type { UpdateProject } from "../types";

export function useSupportVoiceGeneration({
  cacheCurrent,
  narrations,
  narrator,
  update,
}: {
  cacheCurrent: boolean;
  narrations: SupportNarration[];
  narrator: Character | null;
  update: UpdateProject;
}) {
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const runningRef = useRef(false);
  const narration = narrations.find((item) => item.audio.status === "idle" || item.audio.status === "generating");
  const signature = narration ? narrationSignature(narration) : null;

  useEffect(() => {
    if (runningRef.current || !narration || !signature || !narrator || !cacheCurrent) return;
    const timer = window.setTimeout(() => {
      if (runningRef.current) return;
      runningRef.current = true;
      setGeneratingKey(narration.key);
      const input = {
        ...narrator.voice,
        ...narration.voiceOverrides,
        voicevoxName: narrator.voicevoxName,
        text: narration.text,
        kana: narration.kana,
      };
      void fetch("/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "音声生成に失敗しました");
          update((draft) => {
            const current = draft.supportCredits.narrations.find((item) => item.key === narration.key);
            if (!current || signature !== narrationSignature(current)) return;
            current.audio = {
              status: "ready",
              url: result.url,
              durationSeconds: result.durationSeconds,
              error: null,
              inputHash: result.hash,
            };
          });
        })
        .catch((error) =>
          update((draft) => {
            const current = draft.supportCredits.narrations.find((item) => item.key === narration.key);
            if (!current || signature !== narrationSignature(current)) return;
            current.audio = {
              status: "error",
              url: null,
              durationSeconds: null,
              error: error instanceof Error ? error.message : "音声生成に失敗しました",
              inputHash: null,
            };
          }),
        )
        .finally(() => {
          runningRef.current = false;
          setGeneratingKey(null);
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cacheCurrent, generatingKey, narration, narrator, signature, update]);

  return generatingKey;
}

const narrationSignature = (narration: SupportNarration) =>
  JSON.stringify({
    text: narration.text,
    kana: narration.kana,
    characterId: narration.characterId,
    voiceOverrides: narration.voiceOverrides,
  });
