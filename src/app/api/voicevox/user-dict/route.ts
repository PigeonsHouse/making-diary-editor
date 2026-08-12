import { NextResponse } from "next/server";
import { newVoicevoxUserDictWordSchema, voicevoxUserDictSchema } from "../../../../domain/voicevox-user-dict";
import { apiError } from "../../../../server/http";
import { fetchVoicevox } from "../../../../server/voicevox";

function voicevoxHost() {
  return process.env.VOICEVOX_URL ?? "http://localhost:50021";
}

export async function GET() {
  try {
    const response = await fetchVoicevox(
      new URL("/user_dict", voicevoxHost()),
      { cache: "no-store" },
      {
        operation: "ユーザー辞書取得",
      },
    );
    return NextResponse.json(voicevoxUserDictSchema.parse(await response.json()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = newVoicevoxUserDictWordSchema.parse(await request.json());
    const url = new URL("/user_dict_word", voicevoxHost());
    url.searchParams.set("surface", input.surface);
    url.searchParams.set("pronunciation", input.pronunciation);
    url.searchParams.set("accent_type", String(input.accentType));
    url.searchParams.set("word_type", input.wordType);

    const response = await fetchVoicevox(
      url,
      { method: "POST" },
      {
        operation: "ユーザー辞書登録",
        invalidInputMessage: "辞書へ登録する単語の内容が不正です",
      },
    );
    const id = await response.json();
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
