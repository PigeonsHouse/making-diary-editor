type ProgressReporterOptions = {
  intervalMs: number;
  persist: (percent: number) => Promise<void>;
  now?: () => number;
  onError?: (error: unknown) => void;
};

export function createProgressReporter({
  intervalMs,
  persist,
  now = Date.now,
  onError = (error) => console.error("Failed to persist render progress", error),
}: ProgressReporterOptions) {
  let lastPercent = -1;
  let lastPersistedAt = Number.NEGATIVE_INFINITY;
  let pending = Promise.resolve();

  const report = (progress: number) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const timestamp = now();
    if (percent === lastPercent) return;
    if (percent < 100 && timestamp - lastPersistedAt < intervalMs) return;
    lastPercent = percent;
    lastPersistedAt = timestamp;
    pending = pending.then(() => persist(percent)).catch(onError);
  };

  return {
    report,
    flush: () => pending,
  };
}
