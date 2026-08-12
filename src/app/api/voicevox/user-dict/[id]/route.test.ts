import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";

afterEach(() => vi.unstubAllGlobals());

const currentWord = {
  surface: "調声",
  pronunciation: "チョウセイ",
  accent_type: 4,
  mora_count: 4,
  priority: 8,
  part_of_speech: "動詞",
  part_of_speech_detail_1: "自立",
};

describe("VOICEVOX user dictionary word route", () => {
  it("updates a word while preserving its hidden priority", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ "word-id": currentWord }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://app/api/voicevox/user-dict/word-id", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        surface: "調声済み",
        pronunciation: "チョウセイズミ",
        accentType: 5,
        wordType: "VERB",
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "word-id" }) });

    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [calledUrl, calledInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(calledUrl.pathname).toBe("/user_dict_word/word-id");
    expect(Object.fromEntries(calledUrl.searchParams)).toEqual({
      surface: "調声済み",
      pronunciation: "チョウセイズミ",
      accent_type: "5",
      word_type: "VERB",
      priority: "8",
    });
    expect(calledInit).toEqual({ method: "PUT" });
  });

  it("returns 404 before updating a missing word", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://app/api/voicevox/user-dict/missing", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "単語", pronunciation: "タンゴ", accentType: 1, wordType: "COMMON_NOUN" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes the selected word", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await DELETE(new Request("http://app"), { params: Promise.resolve({ id: "word-id" }) });

    expect(response.status).toBe(204);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.pathname).toBe("/user_dict_word/word-id");
    expect(calledInit).toEqual({ method: "DELETE" });
  });
});
