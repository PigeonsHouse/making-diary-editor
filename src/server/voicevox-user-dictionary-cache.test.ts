import { afterEach, describe, expect, it, vi } from "vitest";
import { getVoicevoxUserDictionary, invalidateVoicevoxUserDictionaryCache } from "./voicevox-user-dictionary-cache";

afterEach(() => {
  invalidateVoicevoxUserDictionaryCache();
  vi.unstubAllGlobals();
});

describe("VOICEVOX user dictionary cache", () => {
  it("shares an in-flight dictionary request across a TTS burst", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ word: { surface: "単語" } }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second, third] = await Promise.all([
      getVoicevoxUserDictionary("http://voicevox"),
      getVoicevoxUserDictionary("http://voicevox"),
      getVoicevoxUserDictionary("http://voicevox"),
    ]);

    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a fresh dictionary after invalidation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ word: { accent_type: 1 } }))
      .mockResolvedValueOnce(Response.json({ word: { accent_type: 2 } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getVoicevoxUserDictionary("http://voicevox")).resolves.toEqual({ word: { accent_type: 1 } });
    invalidateVoicevoxUserDictionaryCache();
    await expect(getVoicevoxUserDictionary("http://voicevox")).resolves.toEqual({ word: { accent_type: 2 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
