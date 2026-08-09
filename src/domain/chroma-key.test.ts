import { describe, expect, it } from "vitest";
import { RGB_TO_CHROMA_MATRIX, getChromaKeyAlphaMatrix, getChromaKeyEdgeBlur } from "./chroma-key";

describe("getChromaKeyAlphaMatrix", () => {
  it("creates a matte from squared Cb/Cr distance and similarity", () => {
    const values = getChromaKeyAlphaMatrix({
      enabled: true,
      color: "#00ff00",
      similarity: 0.2,
      edgeBlur: 8,
    })
      .split(" ")
      .map(Number);

    const expectedScale = 1 / (0.22 ** 2 - 0.2 ** 2);
    expect(values[15]).toBeCloseTo(expectedScale);
    expect(values[16]).toBeCloseTo(expectedScale);
    expect(values[17]).toBe(0);
    expect(values[19]).toBeCloseTo(-(0.2 ** 2) * expectedScale);
  });

  it("clamps similarity before creating the matrix", () => {
    const values = getChromaKeyAlphaMatrix({
      enabled: true,
      color: "#00ff00",
      similarity: 2,
      edgeBlur: 0,
    })
      .split(" ")
      .map(Number);

    expect(values).toEqual(Array.from({ length: 20 }, () => 0));
  });

  it("clamps the spatial edge blur to its supported pixel range", () => {
    expect(getChromaKeyEdgeBlur({ enabled: true, color: "#00ff00", similarity: 0.2, edgeBlur: -1 })).toBe(0);
    expect(getChromaKeyEdgeBlur({ enabled: true, color: "#00ff00", similarity: 0.2, edgeBlur: 12 })).toBe(12);
    expect(getChromaKeyEdgeBlur({ enabled: true, color: "#00ff00", similarity: 0.2, edgeBlur: 200 })).toBe(100);
  });

  it("converts RGB into Cb and Cr while preserving alpha", () => {
    const values = RGB_TO_CHROMA_MATRIX.split(" ").map(Number);
    expect(values.slice(0, 5)).toEqual([-0.168736, -0.331264, 0.5, 0, 0.5]);
    expect(values.slice(5, 10)).toEqual([0.5, -0.418688, -0.081312, 0, 0.5]);
    expect(values.slice(15, 20)).toEqual([0, 0, 0, 1, 0]);
  });
});
