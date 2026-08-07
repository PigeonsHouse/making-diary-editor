type ProgressReporterOptions = {
  intervalMs: number;
  persist: (percent: number, etaMs: number | null) => Promise<void>;
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
  let lastEtaMs: number | null = null;
  let lastPersistedAt = Number.NEGATIVE_INFINITY;
  let pending = Promise.resolve();

  const report = (progress: number, etaMs: number | null = null) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 1_000) / 10));
    const normalizedEtaMs =
      etaMs !== null && Number.isFinite(etaMs) && etaMs > 0 && percent < 100 ? Math.round(etaMs / 1_000) * 1_000 : null;
    const timestamp = now();
    if (percent < lastPercent) return;
    if (percent === lastPercent && normalizedEtaMs === lastEtaMs) return;
    if (percent < 100 && timestamp - lastPersistedAt < intervalMs) return;
    lastPercent = percent;
    lastEtaMs = normalizedEtaMs;
    lastPersistedAt = timestamp;
    pending = pending.then(() => persist(percent, normalizedEtaMs)).catch(onError);
  };

  return {
    report,
    flush: () => pending,
  };
}
