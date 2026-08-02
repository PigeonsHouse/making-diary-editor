import { describe, expect, it } from "vitest";
import { createCharacter, createDialogue } from "./defaults";
import { calculateBlock, dialogueAudioStartFrame } from "./timeline";

const ready = (text: string, duration: number, pause: number | null) => ({
  ...createDialogue(character.id),
  text,
  pauseBeforeSeconds: pause,
  audio: {
    status: "ready" as const,
    url: "/audio.wav",
    durationSeconds: duration,
    error: null,
    inputHash: "hash",
  },
});
const character = createCharacter();

describe("calculateBlock", () => {
  it("chains overlapping subtitles until the group ends", () => {
    const result = calculateBlock(
      {
        id: crypto.randomUUID(),
        title: "",
        asset: null,
        durationSeconds: null,
        endHoldSeconds: 0.5,
        dialogues: [ready("A", 4, null), ready("B", 3, -2), ready("C", 2, -1)],
      },
      [character],
    );

    expect(result.dialogues.map((item) => item.start)).toEqual([0, 2, 4]);
    expect(result.dialogues.map((item) => item.displayEnd)).toEqual([6.5, 6.5, 6.5]);
  });

  it("rejects a start before the previous start", () => {
    const result = calculateBlock(
      {
        id: crypto.randomUUID(),
        title: "",
        asset: null,
        durationSeconds: null,
        endHoldSeconds: null,
        dialogues: [ready("A", 1, null), ready("B", 1, -2)],
      },
      [character],
    );
    expect(result.issues).toHaveLength(1);
  });
});

describe("dialogueAudioStartFrame", () => {
  it("keeps the beginning of the first dialogue after the diary intro", () => {
    expect(dialogueAudioStartFrame(33, 0, 30)).toBe(33);
  });

  it("adds both the preceding blocks and the pause before a dialogue", () => {
    expect(dialogueAudioStartFrame(183, 0.5, 30)).toBe(198);
  });
});
