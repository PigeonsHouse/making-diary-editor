import { describe, expect, it, vi } from "vitest";
import { createProgressReporter } from "./render-progress";

describe("createProgressReporter", () => {
  it("throttles storage writes while always persisting completion", async () => {
    let timestamp = 0;
    const persist = vi.fn(async (_percent: number) => undefined);
    const reporter = createProgressReporter({ intervalMs: 750, persist, now: () => timestamp });

    reporter.report(0.01);
    timestamp = 100;
    reporter.report(0.02);
    timestamp = 800;
    reporter.report(0.2);
    timestamp = 850;
    reporter.report(1);
    await reporter.flush();

    expect(persist.mock.calls.map(([percent]) => percent)).toEqual([1, 20, 100]);
  });

  it("does not move persisted progress backwards", async () => {
    let timestamp = 0;
    const persist = vi.fn(async (_percent: number) => undefined);
    const reporter = createProgressReporter({ intervalMs: 1, persist, now: () => timestamp });

    reporter.report(0.4);
    timestamp = 2;
    reporter.report(0.2);
    timestamp = 4;
    reporter.report(0.5);
    await reporter.flush();

    expect(persist.mock.calls.map(([percent]) => percent)).toEqual([40, 50]);
  });

  it("persists progress to one decimal place", async () => {
    let timestamp = 0;
    const persist = vi.fn(async (_percent: number) => undefined);
    const reporter = createProgressReporter({ intervalMs: 1, persist, now: () => timestamp });

    reporter.report(0.1234);
    timestamp = 2;
    reporter.report(0.1236);
    await reporter.flush();

    expect(persist.mock.calls.map(([percent]) => percent)).toEqual([12.3, 12.4]);
  });

  it("refreshes the ETA even while the displayed percentage is unchanged", async () => {
    let timestamp = 0;
    const persist = vi.fn(async (_percent: number, _etaMs: number | null) => undefined);
    const reporter = createProgressReporter({ intervalMs: 750, persist, now: () => timestamp });

    reporter.report(0.1234, 120_400);
    timestamp = 800;
    reporter.report(0.12345, 115_600);
    timestamp = 1_600;
    reporter.report(1, 1_000);
    await reporter.flush();

    expect(persist.mock.calls).toEqual([
      [12.3, 120_000],
      [12.3, 116_000],
      [100, null],
    ]);
  });
});
