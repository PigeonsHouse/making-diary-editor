import { describe, expect, it } from "vitest";
import { getChromaKeyAlphaMatrix } from "./chroma-key";

describe("getChromaKeyAlphaMatrix", () => {
  it("maps the average RGB distance through similarity and smoothness", () => {
    const values = getChromaKeyAlphaMatrix({
      enabled: true,
      color: "#00ff00",
      similarity: 0.2,
      smoothness: 0.1,
    })
      .split(" ")
      .map(Number);

    for (const value of values.slice(15, 18)) expect(value).toBeCloseTo(10 / 3);
    expect(values[19]).toBe(-2);
  });

  it("clamps invalid ranges before creating the matrix", () => {
    const values = getChromaKeyAlphaMatrix({
      enabled: true,
      color: "#00ff00",
      similarity: 2,
      smoothness: 0,
    })
      .split(" ")
      .map(Number);

    expect(values[15]).toBeCloseTo(1 / 0.003);
    expect(values[19]).toBe(-1000);
  });
});
