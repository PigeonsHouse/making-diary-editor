import {NextResponse} from "next/server";
import {z} from "zod";
import {apiError} from "@/server/http";

const schema = z.object({
  text: z.string().min(1),
  voicevoxName: z.string().min(1),
  styleName: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const host = process.env.VOICEVOX_URL ?? "http://localhost:50021";
    const speakersResponse = await fetch(new URL("/speakers", host));
    if (!speakersResponse.ok) throw new Error("VOICEVOXの話者一覧を取得できません");
    const speakers = await speakersResponse.json() as Array<{
      name: string;
      styles: Array<{name: string; id: number}>;
    }>;
    const speaker = speakers.find((item) => item.name === input.voicevoxName);
    const styleId = speaker?.styles.find((item) => item.name === input.styleName)?.id;
    if (styleId === undefined) throw new Error("VOICEVOXの話者またはスタイルが見つかりません");

    const queryUrl = new URL("/audio_query", host);
    queryUrl.searchParams.set("text", input.text);
    queryUrl.searchParams.set("speaker", String(styleId));
    const queryResponse = await fetch(queryUrl, {method: "POST"});
    if (!queryResponse.ok) throw new Error(`VOICEVOX audio_query: ${queryResponse.status}`);
    const audioQuery = await queryResponse.json() as {kana?: string | null};
    if (!audioQuery.kana) throw new Error("VOICEVOXからkanaを取得できませんでした");
    return NextResponse.json({kana: audioQuery.kana});
  } catch (error) {
    return apiError(error);
  }
}
