import {describe, expect, it} from "vitest";
import {calculateAvatarPositions, isAvatarFlipped} from "./avatar-layout";

describe("calculateAvatarPositions", () => {
  it("uses per-diary values for each character and stacks independently on each side", () => {
    const positions = calculateAvatarPositions([
      {id: "right-front", edgeOffsetXPx: 10, peekYPx: 180},
      {id: "left-front", edgeOffsetXPx: 20, peekYPx: 180},
      {id: "right-back", edgeOffsetXPx: 30, peekYPx: 180},
      {id: "left-back", edgeOffsetXPx: 40, peekYPx: 180},
    ], {
      "right-front": {peekYPx: 100, edgeOffsetXPx: -20},
      "left-front": {peekYPx: 120},
      "right-back": {peekYPx: 40},
      "left-back": {peekYPx: 60, edgeOffsetXPx: -50},
    }, 800);

    expect(positions.map(({side, top, edgeOffsetXPx}) => ({side, top, edgeOffsetXPx}))).toEqual([
      {side: "right", top: 700, edgeOffsetXPx: -20},
      {side: "left", top: 680, edgeOffsetXPx: 20},
      {side: "right", top: 660, edgeOffsetXPx: 30},
      {side: "left", top: 620, edgeOffsetXPx: -50},
    ]);
  });

  it("falls back to both character defaults when the diary has no overrides", () => {
    const [position] = calculateAvatarPositions([
      {id: "character", edgeOffsetXPx: -15, peekYPx: 180},
    ], {}, 800);
    expect(position).toMatchObject({top: 620, edgeOffsetXPx: -15});
  });
});

describe("isAvatarFlipped", () => {
  it("defaults left-side characters to flipped and allows a video override", () => {
    expect(isAvatarFlipped(0)).toBe(false);
    expect(isAvatarFlipped(1)).toBe(true);
    expect(isAvatarFlipped(1, false)).toBe(false);
    expect(isAvatarFlipped(0, true)).toBe(true);
  });
});
