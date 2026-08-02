import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiError } from "@/server/http";
import { fetchVoicevox } from "@/server/voicevox";
import { getWavDurationSeconds } from "@/server/wav";

const schema = z.object({
  text: z.string().min(1),
  kana: z.string().nullable().optional(),
  voicevoxName: z.string().min(1),
  styleName: z.string().min(1),
  speed: z.number().positive(),
  pitch: z.number(),
  intonation: z.number().nonnegative(),
  volume: z.number().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
    const audioDir = path.join(dataDir, "audio");
    const target = path.join(audioDir, `${hash}.wav`);
    await mkdir(audioDir, { recursive: true });
    try {
      const cachedAudio = await readFile(target);
      const durationSeconds = getWavDurationSeconds(cachedAudio);
      if (durationSeconds) {
        return NextResponse.json({ hash, url: `/api/files/audio/${hash}.wav`, durationSeconds });
      }
    } catch {}

    const host = process.env.VOICEVOX_URL ?? "http://localhost:50021";
    const speakersResponse = await fetchVoicevox(new URL("/speakers", host), undefined, { operation: "話者一覧取得" });
    const speakers = (await speakersResponse.json()) as Array<{
      name: string;
      styles: Array<{ name: string; id: number }>;
    }>;
    const speaker = speakers.find((item) => item.name === input.voicevoxName);
    const styleId = speaker?.styles.find((item) => item.name === input.styleName)?.id;
    if (styleId === undefined) throw new Error("VOICEVOXの話者またはスタイルが見つかりません");
    const queryUrl = new URL("/audio_query", host);
    queryUrl.searchParams.set("text", input.text);
    queryUrl.searchParams.set("speaker", String(styleId));
    const queryResponse = await fetchVoicevox(
      queryUrl,
      { method: "POST" },
      {
        operation: "テキスト解析",
        invalidInputMessage: "テキストをVOICEVOXで解析できませんでした",
      },
    );
    const audioQuery = await queryResponse.json();
    if (input.kana) {
      const phrasesUrl = new URL("/accent_phrases", host);
      phrasesUrl.searchParams.set("text", input.kana);
      phrasesUrl.searchParams.set("speaker", String(styleId));
      phrasesUrl.searchParams.set("is_kana", "true");
      const phrasesResponse = await fetchVoicevox(
        phrasesUrl,
        { method: "POST" },
        {
          operation: "kana解析",
          invalidInputMessage: "kanaの形式が不正です。AquesTalk風記法を確認してください",
        },
      );
      audioQuery.accent_phrases = await phrasesResponse.json();
      audioQuery.kana = input.kana;
    }
    Object.assign(audioQuery, {
      speedScale: input.speed,
      pitchScale: input.pitch,
      intonationScale: input.intonation,
      volumeScale: input.volume,
      prePhonemeLength: 0,
      postPhonemeLength: 0,
    });
    const synthUrl = new URL("/synthesis", host);
    synthUrl.searchParams.set("speaker", String(styleId));
    const synth = await fetchVoicevox(
      synthUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(audioQuery),
      },
      {
        operation: "音声合成",
        invalidInputMessage: "音声設定または入力内容が不正です",
      },
    );
    const audio = Buffer.from(await synth.arrayBuffer());
    const durationSeconds = getWavDurationSeconds(audio);
    if (!durationSeconds) {
      throw new ApiError(400, "VOICEVOXから発音可能な音声が生成されませんでした。セリフまたはkanaを確認してください");
    }

    const temporaryTarget = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryTarget, audio);
      await rename(temporaryTarget, target);
    } finally {
      await rm(temporaryTarget, { force: true });
    }
    return NextResponse.json({ hash, url: `/api/files/audio/${hash}.wav`, durationSeconds });
  } catch (error) {
    return apiError(error);
  }
}
