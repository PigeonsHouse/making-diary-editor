import {NextResponse} from "next/server";
import {z} from "zod";
import type {Character} from "@/domain/types";
import {apiError} from "@/server/http";

const inputSchema = z.object({
  memo: z.string().min(1),
  characters: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    personality: z.string(),
  })).min(1),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({error: "GEMINI_API_KEYが設定されていません"}, {status: 503});
    }
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const prompt = [
      "製作日誌のメモを、自然で簡潔な掛け合いへ変換してください。",
      "事実を追加せず、characterIdとtextだけをJSON配列で返してください。",
      `キャラクター: ${JSON.stringify(input.characters)}`,
      `メモ: ${input.memo}`,
    ].join("\n");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          contents: [{parts: [{text: prompt}]}],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  characterId: {type: "STRING"},
                  text: {type: "STRING"},
                },
                required: ["characterId", "text"],
              },
            },
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini API: ${response.status} ${await response.text()}`);
    const body = await response.json();
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    const generated = z.array(z.object({
      characterId: z.string().uuid(),
      text: z.string().min(1),
    })).parse(JSON.parse(text));
    const allowed = new Set(input.characters.map((item) => item.id));
    return NextResponse.json(generated.filter((item) => allowed.has(item.characterId)));
  } catch (error) {
    return apiError(error);
  }
}
