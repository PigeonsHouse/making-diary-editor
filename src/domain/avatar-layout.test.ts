import { describe, expect, it } from "vitest";
import { calculateAvatarBounceOffset, calculateAvatarPositions, isAvatarFlipped } from "./avatar-layout";

describe("calculateAvatarBounceOffset", () => {
  it("jumps once and scales the height with the rendered avatar", () => {
    expect(calculateAvatarBounceOffset(undefined, 10, 20, 1.25)).toBe(0);
    expect(calculateAvatarBounceOffset(0, 10, 20, 1.25)).toBeCloseTo(0);
    expect(calculateAvatarBounceOffset(5, 10, 20, 1.25)).toBeCloseTo(-25);
    expect(calculateAvatarBounceOffset(10, 10, 20, 1.25)).toBeCloseTo(0);
    expect(calculateAvatarBounceOffset(11, 10, 20, 1.25)).toBe(0);
  });
});

describe("calculateAvatarPositions", () => {
  it("uses per-diary values for each character and stacks independently on each side", () => {
    const positions = calculateAvatarPositions(
      [
        { id: "right-front", edgeOffsetXPx: 10, peekYPx: 180, scale: 1 },
        { id: "left-front", edgeOffsetXPx: 20, peekYPx: 180, scale: 1 },
        { id: "right-back", edgeOffsetXPx: 30, peekYPx: 180, scale: 1 },
        { id: "left-back", edgeOffsetXPx: 40, peekYPx: 180, scale: 1 },
      ],
      {
        "right-front": { peekYPx: 100, edgeOffsetXPx: -20 },
        "left-front": { peekYPx: 120 },
        "right-back": { peekYPx: 40 },
        "left-back": { peekYPx: 60, edgeOffsetXPx: -50 },
      },
      800,
      700,
    );

    expect(positions.map(({ side, top, edgeOffsetXPx }) => ({ side, top, edgeOffsetXPx }))).toEqual([
      { side: "right", top: 350, edgeOffsetXPx: -20 },
      { side: "left", top: 330, edgeOffsetXPx: 20 },
      { side: "right", top: 310, edgeOffsetXPx: 30 },
      { side: "left", top: 270, edgeOffsetXPx: -50 },
    ]);
  });

  it("falls back to both character defaults when the diary has no overrides", () => {
    const [position] = calculateAvatarPositions(
      [{ id: "character", edgeOffsetXPx: -15, peekYPx: 180, scale: 1 }],
      {},
      800,
      700,
    );
    expect(position).toMatchObject({ top: 270, edgeOffsetXPx: -15 });
  });

  it("anchors Y from the image center and scales both offsets with the avatar", () => {
    const [position] = calculateAvatarPositions(
      [{ id: "character", edgeOffsetXPx: -20, peekYPx: 100, scale: 1.25 }],
      {},
      800,
      700,
    );

    expect(position).toMatchObject({ top: 237.5, edgeOffsetXPx: -25, scale: 1.25 });
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
