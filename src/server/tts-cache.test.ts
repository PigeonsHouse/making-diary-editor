import { describe, expect, it } from "vitest";
import { createTtsCacheHash } from "./tts-cache";

const input = {
  text: "製作日誌",
  kana: null,
  voicevoxName: "ずんだもん",
  styleName: "ノーマル",
  speed: 1,
  pitch: 0,
  intonation: 1,
  volume: 1,
};

const word = {
  surface: "製作日誌",
  pronunciation: "セイサクニッシ",
  accent_type: 5,
  mora_count: 7,
  priority: 5,
  part_of_speech: "名詞",
  part_of_speech_detail_1: "固有名詞",
};

describe("createTtsCacheHash", () => {
  it("changes when a user dictionary word is registered, edited, or deleted", () => {
    const withoutWord = createTtsCacheHash(input, {});
    const withWord = createTtsCacheHash(input, { "word-id": word });
    const editedWord = createTtsCacheHash(input, {
      "word-id": { ...word, pronunciation: "セーサクニッシ", accent_type: 3 },
    });

    expect(withWord).not.toBe(withoutWord);
    expect(editedWord).not.toBe(withWord);
    expect(createTtsCacheHash(input, {})).toBe(withoutWord);
  });

  it("is stable when dictionary keys and properties arrive in a different order", () => {
    const first = createTtsCacheHash(input, {
      b: { surface: "ビー", pronunciation: "ビー" },
      a: word,
    });
    const second = createTtsCacheHash(input, {
      a: {
        priority: 5,
        mora_count: 7,
        accent_type: 5,
        pronunciation: "セイサクニッシ",
        surface: "製作日誌",
        part_of_speech_detail_1: "固有名詞",
        part_of_speech: "名詞",
      },
      b: { pronunciation: "ビー", surface: "ビー" },
    });

    expect(second).toBe(first);
  });

  it("still changes when the TTS input changes", () => {
    expect(createTtsCacheHash({ ...input, speed: 1.2 }, {})).not.toBe(createTtsCacheHash(input, {}));
  });
});
