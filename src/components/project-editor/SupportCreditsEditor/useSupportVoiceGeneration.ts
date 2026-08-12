"use client";

import { useEffect, useRef, useState } from "react";
import { requestVoice } from "@/components/voice-api";
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
  const [requestState, setRequestState] = useState<{ key: string; status: "waiting" | "generating" } | null>(null);
  const runningRef = useRef(false);
  const verifiedRequestsRef = useRef(new Set<string>());
  const narration = narrations.find((item) => {
    if (item.audio.status === "idle" || item.audio.status === "generating") return true;
    if (item.audio.status !== "ready" || !narrator) return false;
    return !verifiedRequestsRef.current.has(narrationRequestSignature(item, narrator));
  });
  const signature = narration ? narrationSignature(narration) : null;
  const requestSignature = narration && narrator ? narrationRequestSignature(narration, narrator) : null;

  useEffect(() => {
    if (runningRef.current || !narration || !signature || !requestSignature || !narrator || !cacheCurrent) return;
    const timer = window.setTimeout(() => {
      if (runningRef.current) return;
      runningRef.current = true;
      verifiedRequestsRef.current.add(requestSignature);
      setRequestState({ key: narration.key, status: "waiting" });
      const input = {
        ...narrator.voice,
        ...narration.voiceOverrides,
        voicevoxName: narrator.voicevoxName,
        text: narration.text,
        kana: narration.kana,
      };
      void requestVoice(input, {
        onStart: () => setRequestState({ key: narration.key, status: "generating" }),
      })
        .then((result) => {
          if (
            narration.audio.status === "ready" &&
            narration.audio.inputHash === result.hash &&
            narration.audio.url === result.url &&
            narration.audio.durationSeconds === result.durationSeconds
          ) {
            return;
          }
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
          setRequestState(null);
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cacheCurrent, narration, narrator, requestSignature, signature, update]);

  return requestState ?? (narration ? { key: narration.key, status: "waiting" as const } : null);
}

const narrationSignature = (narration: SupportNarration) =>
  JSON.stringify({
    text: narration.text,
    kana: narration.kana,
    characterId: narration.characterId,
    voiceOverrides: narration.voiceOverrides,
  });

const narrationRequestSignature = (narration: SupportNarration, narrator: Character) =>
  JSON.stringify({
    narration: narrationSignature(narration),
    voicevoxName: narrator.voicevoxName,
    voice: narrator.voice,
  });
