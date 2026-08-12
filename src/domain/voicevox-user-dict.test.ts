import { describe, expect, it } from "vitest";
import {
  isHighPitchMora,
  isValidVoicevoxPronunciation,
  newVoicevoxUserDictWordSchema,
  splitVoicevoxMoras,
  voicevoxWordTypeFromWord,
} from "./voicevox-user-dict";

describe("splitVoicevoxMoras", () => {
  it.each([
    ["セイサクニッシ", ["セ", "イ", "サ", "ク", "ニ", "ッ", "シ"]],
    ["キャット", ["キャ", "ッ", "ト"]],
    ["ティッシュ", ["ティ", "ッ", "シュ"]],
    ["クヮイ", ["クヮ", "イ"]],
    ["スーパー", ["ス", "ー", "パ", "ー"]],
  ])("splits %s with the same compound-mora rules as VOICEVOX", (pronunciation, expected) => {
    expect(splitVoicevoxMoras(pronunciation)).toEqual(expected);
  });

  it.each(["せいさく", "ｾｲｻｸ", "キャャ", "ッッ", "カヮ"])('rejects invalid pronunciation "%s"', (value) => {
    expect(isValidVoicevoxPronunciation(value)).toBe(false);
    expect(splitVoicevoxMoras(value)).toEqual([]);
  });
});

describe("VOICEVOX accent type", () => {
  it("validates the accent position against the mora count", () => {
    const valid = { surface: "テスト", pronunciation: "テスト", wordType: "PROPER_NOUN" as const };
    expect(newVoicevoxUserDictWordSchema.safeParse({ ...valid, accentType: 3 }).success).toBe(true);
    expect(newVoicevoxUserDictWordSchema.safeParse({ ...valid, accentType: 4 }).success).toBe(false);
  });

  it.each([
    [0, [false, true, true]],
    [1, [true, false, false]],
    [2, [false, true, false]],
    [3, [false, true, true]],
  ])("calculates the pitch preview for accent type %i", (accentType, expected) => {
    expect([0, 1, 2].map((index) => isHighPitchMora(index, accentType))).toEqual(expected);
  });
});

describe("voicevoxWordTypeFromWord", () => {
  it.each([
    ["名詞", "固有名詞", "PROPER_NOUN"],
    ["名詞", "一般", "COMMON_NOUN"],
    ["動詞", "自立", "VERB"],
    ["形容詞", "自立", "ADJECTIVE"],
    ["名詞", "接尾", "SUFFIX"],
  ] as const)("maps %s / %s to %s", (partOfSpeech, detail, expected) => {
    expect(
      voicevoxWordTypeFromWord({
        surface: "単語",
        pronunciation: "タンゴ",
        accent_type: 1,
        mora_count: 3,
        priority: 5,
        part_of_speech: partOfSpeech,
        part_of_speech_detail_1: detail,
      }),
    ).toBe(expected);
  });
});
