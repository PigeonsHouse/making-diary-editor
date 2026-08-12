import { NextResponse } from "next/server";
import { newVoicevoxUserDictWordSchema, voicevoxUserDictSchema } from "../../../../../domain/voicevox-user-dict";
import { ApiError, apiError } from "../../../../../server/http";
import { fetchVoicevox } from "../../../../../server/voicevox";

type Context = { params: Promise<{ id: string }> };

function voicevoxHost() {
  return process.env.VOICEVOX_URL ?? "http://localhost:50021";
}

export async function PUT(request: Request, context: Context) {
  try {
    const [{ id }, input] = await Promise.all([
      context.params,
      request.json().then((body) => newVoicevoxUserDictWordSchema.parse(body)),
    ]);
    const dictionaryResponse = await fetchVoicevox(
      new URL("/user_dict", voicevoxHost()),
      { cache: "no-store" },
      { operation: "ユーザー辞書取得" },
    );
    const currentWord = voicevoxUserDictSchema.parse(await dictionaryResponse.json())[id];
    if (!currentWord) throw new ApiError(404, "編集する単語が見つかりません");

    const url = new URL(`/user_dict_word/${encodeURIComponent(id)}`, voicevoxHost());
    url.searchParams.set("surface", input.surface);
    url.searchParams.set("pronunciation", input.pronunciation);
    url.searchParams.set("accent_type", String(input.accentType));
    url.searchParams.set("word_type", input.wordType);
    url.searchParams.set("priority", String(currentWord.priority));
    await fetchVoicevox(
      url,
      { method: "PUT" },
      {
        operation: "ユーザー辞書更新",
        invalidInputMessage: "辞書を更新する単語の内容が不正です",
      },
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await fetchVoicevox(
      new URL(`/user_dict_word/${encodeURIComponent(id)}`, voicevoxHost()),
      { method: "DELETE" },
      { operation: "ユーザー辞書削除" },
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
