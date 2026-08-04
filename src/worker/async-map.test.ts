import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./async-map";

describe("mapWithConcurrency", () => {
  it("preserves input order", async () => {
    await expect(mapWithConcurrency([3, 1, 2], 2, async (value) => value * 2)).resolves.toEqual([6, 2, 4]);
  });

  it("does not exceed the requested concurrency", async () => {
    let active = 0;
    let maximum = 0;
    await mapWithConcurrency([1, 2, 3, 4], 2, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
    });
    expect(maximum).toBe(2);
  });
});
