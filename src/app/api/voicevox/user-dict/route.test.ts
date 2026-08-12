import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("VOICEVOX user dictionary route", () => {
  it("returns the registered words", async () => {
    const words = {
      "word-id": {
        surface: "調声",
        pronunciation: "チョウセイ",
        accent_type: 4,
        mora_count: 4,
        priority: 5,
        part_of_speech: "動詞",
        part_of_speech_detail_1: "自立",
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(words)));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(words);
    expect(fetch).toHaveBeenCalledWith(new URL("http://localhost:50021/user_dict"), { cache: "no-store" });
  });

  it("registers a word without overriding VOICEVOX priority", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json("new-word-id"));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://app/api/voicevox/user-dict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        surface: "製作日誌",
        pronunciation: "セイサクニッシ",
        accentType: 5,
        wordType: "PROPER_NOUN",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "new-word-id" });
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.pathname).toBe("/user_dict_word");
    expect(Object.fromEntries(calledUrl.searchParams)).toEqual({
      surface: "製作日誌",
      pronunciation: "セイサクニッシ",
      accent_type: "5",
      word_type: "PROPER_NOUN",
    });
    expect(calledUrl.searchParams.has("priority")).toBe(false);
    expect(calledInit).toEqual({ method: "POST" });
  });

  it("rejects an unknown word type before calling VOICEVOX", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://app/api/voicevox/user-dict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "単語", pronunciation: "タンゴ", accentType: 1, wordType: "NOUN" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
