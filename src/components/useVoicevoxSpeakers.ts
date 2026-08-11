"use client";

import { useEffect, useState } from "react";

export type VoicevoxSpeaker = { name: string; styles: Array<{ name: string; id: number }> };

let cachedSpeakers: VoicevoxSpeaker[] | null = null;
let speakersPromise: Promise<VoicevoxSpeaker[]> | null = null;

function loadVoicevoxSpeakers() {
  if (cachedSpeakers) return Promise.resolve(cachedSpeakers);
  speakersPromise ??= fetch("/api/voicevox/speakers")
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "VOICEVOXからスタイルを取得できませんでした");
      if (!Array.isArray(result)) throw new Error("VOICEVOXのスタイル一覧が不正です");
      cachedSpeakers = result as VoicevoxSpeaker[];
      return cachedSpeakers;
    })
    .finally(() => {
      speakersPromise = null;
    });
  return speakersPromise;
}

export function useVoicevoxSpeakers(enabled = true) {
  const [speakers, setSpeakers] = useState<VoicevoxSpeaker[]>(cachedSpeakers ?? []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void loadVoicevoxSpeakers()
      .then((loaded) => {
        if (!cancelled) setSpeakers(loaded);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "スタイルを取得できませんでした");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  return { speakers, error, loading, retry: () => setAttempt((current) => current + 1) };
}
