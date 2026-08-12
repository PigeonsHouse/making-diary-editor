import { describe, expect, it } from "vitest";
import { createTtsGenerationCoordinator } from "./tts-generation-coordinator";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe("TTS generation coordinator", () => {
  it("shares one generation between simultaneous requests for the same hash", async () => {
    const coordinator = createTtsGenerationCoordinator(2);
    const completion = deferred<string>();
    let calls = 0;
    const task = () => {
      calls += 1;
      return completion.promise;
    };

    const first = coordinator.run("same", task);
    const second = coordinator.run("same", task);
    await Promise.resolve();
    completion.resolve("audio");

    await expect(Promise.all([first, second])).resolves.toEqual(["audio", "audio"]);
    expect(calls).toBe(1);
  });

  it("limits different generations to the configured concurrency", async () => {
    const coordinator = createTtsGenerationCoordinator(2);
    const completions = [deferred<void>(), deferred<void>(), deferred<void>()];
    let active = 0;
    let maximumActive = 0;
    const run = (index: number) =>
      coordinator.run(String(index), async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await completions[index].promise;
        active -= 1;
      });

    const tasks = [run(0), run(1), run(2)];
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(active).toBe(2);
    completions[0].resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(active).toBe(2);
    completions[1].resolve();
    completions[2].resolve();

    await Promise.all(tasks);
    expect(maximumActive).toBe(2);
  });

  it("allows a failed hash to be retried", async () => {
    const coordinator = createTtsGenerationCoordinator(1);
    await expect(coordinator.run("retry", async () => Promise.reject(new Error("failed")))).rejects.toThrow("failed");
    await expect(coordinator.run("retry", async () => "recovered")).resolves.toBe("recovered");
  });
});
