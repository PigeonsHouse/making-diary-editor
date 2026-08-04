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
});
