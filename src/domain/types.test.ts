import {describe, expect, it} from "vitest";
import {dialogueSchema} from "./types";

describe("dialogueSchema", () => {
  it("未指定の音声上書きへキャラクター既定相当の値を補完しない", () => {
    const dialogue = dialogueSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      text: "テスト",
      voiceOverrides: {},
      psdOverrides: {},
      audio: {},
    });

    expect(dialogue.voiceOverrides).toEqual({});
  });
});
