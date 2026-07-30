import {createHash} from "node:crypto";
import {mkdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {NextResponse} from "next/server";
import {z} from "zod";
import {apiError} from "@/server/http";

const schema = z.object({
  text: z.string().min(1),
  kana: z.string().nullable().optional(),
  styleId: z.number().int().nonnegative(),
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
    await mkdir(audioDir, {recursive: true});
    try {
      const info = await stat(target);
      if (info.size > 44) return NextResponse.json({hash, url: `/api/files/audio/${hash}.wav`});
    } catch {}

    const host = process.env.VOICEVOX_URL ?? "http://localhost:50021";
    const queryText = input.kana || input.text;
    const queryUrl = new URL("/audio_query", host);
    queryUrl.searchParams.set("text", queryText);
    queryUrl.searchParams.set("speaker", String(input.styleId));
    if (input.kana) queryUrl.searchParams.set("is_kana", "true");
    const queryResponse = await fetch(queryUrl, {method: "POST"});
    if (!queryResponse.ok) throw new Error(`VOICEVOX audio_query: ${queryResponse.status}`);
    const audioQuery = await queryResponse.json();
    Object.assign(audioQuery, {
      speedScale: input.speed,
      pitchScale: input.pitch,
      intonationScale: input.intonation,
      volumeScale: input.volume,
      prePhonemeLength: 0,
      postPhonemeLength: 0,
    });
    const synthUrl = new URL("/synthesis", host);
    synthUrl.searchParams.set("speaker", String(input.styleId));
    const synth = await fetch(synthUrl, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(audioQuery),
    });
    if (!synth.ok) throw new Error(`VOICEVOX synthesis: ${synth.status}`);
    await writeFile(target, Buffer.from(await synth.arrayBuffer()));
    return NextResponse.json({hash, url: `/api/files/audio/${hash}.wav`});
  } catch (error) {
    return apiError(error);
  }
}
