import {NextResponse} from "next/server";
import {z} from "zod";
import type {Character} from "@/domain/types";
import {apiError} from "@/server/http";

const inputSchema = z.object({
  memo: z.string().min(1),
  characters: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        personality: z.string(),
      }),
    )
    .min(1),
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
      "製作日誌のメモを、キャラクター同士の自然な掛け合いへ変換してください。",
      "出力は最低10発話程度にしてください。メモの内容が多ければ10発話を超えて構いません。1発話はJSON配列の1要素＝1人の1発話です。",
      "これは雑談ではなく製作日誌の台本です。メモから読み取れる範囲で、何を作ったか、どんな機能を追加したか、どんなバグを直したか、どこで詰まったか、何を試したか、どう解決したか、または何が未解決かを会話の中心にしてください。",
      "最初に作業の概要が分かり、その後に具体的な変更点や苦労を掘り下げ、最後に成果や現在の状態が分かる流れを優先してください。",
      "必ずしもメモの話題の順に沿う必要はなく、自然な流れになるのであれば多少前後させても良いです。",
      "一方のキャラクターが作業内容を話し、もう一方が理由・挙動・苦労した点を質問したり、理解を確かめたりすることで、視聴者に製作の文脈が伝わる掛け合いにしてください。",
      "登場キャラクターが2人以上なら、必ず複数人を使い、説明役ひとりが話し続ける構成を避けてください。",
      "前の発話への相づち、短い質問、回答、感想、軽いツッコミを交ぜてください。ただし、すべての発話に返答や相づちを付ける必要はありません。言い切ったまま次の作業内容へ移るセリフや、返答を挟まず関連する別の話題へ進む箇所も作ってください。",
      "ひとつの話題を毎回きれいに完結させてから次へ進むのではなく、内容が伝わったところで適度に話題を切り替え、製作日誌として小気味よい速度感を持たせてください。ただし、唐突で文脈を追えない切り替えや、重要な原因・結果の説明不足は避けてください。",
      "同じ話者を3発話以上連続させないでください。各発話は簡潔な1〜2文にしてください。",
      "メモにない機能、バグ、原因、解決方法、作業結果、感情、今後の予定は追加しないでください。情報がない項目は無理に触れず、発話数を満たすための重複や不自然な水増しも避けてください。",
      "characterIdとtextだけをJSON配列で返してください。",
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
    const generated = z
      .array(
        z.object({
          characterId: z.string().uuid(),
          text: z.string().min(1),
        }),
      )
      .parse(JSON.parse(text));
    const allowed = new Set(input.characters.map((item) => item.id));
    return NextResponse.json(generated.filter((item) => allowed.has(item.characterId)));
  } catch (error) {
    return apiError(error);
  }
}
