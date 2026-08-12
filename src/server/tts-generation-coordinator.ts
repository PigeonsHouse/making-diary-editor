type Task<T> = () => Promise<T>;

export function createTtsGenerationCoordinator(concurrency: number) {
  const limit = Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 2;
  const pending: Array<() => void> = [];
  const flights = new Map<string, Promise<unknown>>();
  let active = 0;

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (active < limit) {
        active += 1;
        resolve();
        return;
      }
      pending.push(() => {
        active += 1;
        resolve();
      });
    });

  const release = () => {
    active -= 1;
    pending.shift()?.();
  };

  const schedule = async <T>(task: Task<T>) => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };

  return {
    run<T>(key: string, task: Task<T>): Promise<T> {
      const current = flights.get(key) as Promise<T> | undefined;
      if (current) return current;

      const promise = schedule(task).finally(() => {
        if (flights.get(key) === promise) flights.delete(key);
      });
      flights.set(key, promise);
      return promise;
    },
  };
}

function configuredConcurrency() {
  const value = Number(process.env.TTS_CONCURRENCY ?? "2");
  return Number.isInteger(value) && value > 0 ? value : 2;
}

const globalCoordinator = globalThis as typeof globalThis & {
  __makingDiaryTtsCoordinator?: ReturnType<typeof createTtsGenerationCoordinator>;
};

export const ttsGenerationCoordinator =
  globalCoordinator.__makingDiaryTtsCoordinator ?? createTtsGenerationCoordinator(configuredConcurrency());

globalCoordinator.__makingDiaryTtsCoordinator = ttsGenerationCoordinator;
