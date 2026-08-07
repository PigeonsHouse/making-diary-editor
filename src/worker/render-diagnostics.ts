import type { OnStartData, RenderMediaProgress, SlowFrame } from "@remotion/renderer";
import { calculateDetailedRenderProgress } from "./render-progress-value";

type RenderDiagnosticsOptions = {
  renderJobId: string;
  totalFrames: number;
  intervalMs: number;
  now?: () => number;
  memoryUsage?: () => NodeJS.MemoryUsage;
  log?: (message: string) => void;
};

const formatDuration = (milliseconds: number | null) => {
  if (milliseconds === null || !Number.isFinite(milliseconds) || milliseconds < 0) return "unknown";
  const seconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
};

const formatMegabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;
const percent = (value: number, total: number) => (total > 0 ? ((value / total) * 100).toFixed(1) : "0.0");

export function createRenderDiagnostics({
  renderJobId,
  totalFrames,
  intervalMs,
  now = Date.now,
  memoryUsage = process.memoryUsage,
  log = console.log,
}: RenderDiagnosticsOptions) {
  const prefix = `[render:${renderJobId}]`;
  const startedAt = now();
  let lastChangeAt = startedAt;
  let lastLogAt = startedAt;
  let lastLoggedRendered = 0;
  let lastLoggedEncoded = 0;
  let latest: RenderMediaProgress | null = null;
  let previousStage: RenderMediaProgress["stitchStage"] | null = null;
  let downloadsStarted = 0;
  let downloadsCompleted = 0;
  let downloadedBytes = 0;

  const writeProgress = (reason: "interval" | "phase" | "heartbeat") => {
    if (!latest) {
      log(`${prefix} heartbeat waiting for the first frame (${formatDuration(now() - startedAt)} elapsed)`);
      lastLogAt = now();
      return;
    }
    const timestamp = now();
    const sampleSeconds = Math.max(0.001, (timestamp - lastLogAt) / 1000);
    const renderedRate = (latest.renderedFrames - lastLoggedRendered) / sampleSeconds;
    const encodedRate = (latest.encodedFrames - lastLoggedEncoded) / sampleSeconds;
    const memory = memoryUsage();
    const detailedProgress = calculateDetailedRenderProgress(latest, totalFrames);
    const inactivity =
      latest.renderedFrames >= totalFrames && latest.encodedFrames < totalFrames
        ? `finalizing=${formatDuration(timestamp - lastChangeAt)}`
        : `idle=${formatDuration(timestamp - lastChangeAt)}`;
    log(
      `${prefix} progress=${(detailedProgress * 100).toFixed(1)}% phase=${latest.stitchStage} ` +
        `rendered=${latest.renderedFrames}/${totalFrames} (${percent(latest.renderedFrames, totalFrames)}%, ${renderedRate.toFixed(1)}fps) ` +
        `encoded=${latest.encodedFrames}/${totalFrames} (${percent(latest.encodedFrames, totalFrames)}%, ${encodedRate.toFixed(1)}fps) ` +
        `${inactivity} eta=${formatDuration(latest.renderEstimatedTime)} ` +
        `downloads=${downloadsCompleted}/${downloadsStarted} (${formatMegabytes(downloadedBytes)}) ` +
        `rss=${formatMegabytes(memory.rss)} heap=${formatMegabytes(memory.heapUsed)} reason=${reason}`,
    );
    lastLogAt = timestamp;
    lastLoggedRendered = latest.renderedFrames;
    lastLoggedEncoded = latest.encodedFrames;
  };

  const heartbeat = setInterval(() => {
    if (now() - lastLogAt >= intervalMs * 0.9) writeProgress("heartbeat");
  }, intervalMs);
  heartbeat.unref();

  return {
    onStart({ frameCount, parallelEncoding, resolvedConcurrency }: OnStartData) {
      log(
        `${prefix} renderer started frameCount=${frameCount}, resolvedConcurrency=${resolvedConcurrency}, ` +
          `parallelEncoding=${parallelEncoding}`,
      );
    },
    onProgress(progress: RenderMediaProgress) {
      const timestamp = now();
      const changed =
        latest === null ||
        latest.renderedFrames !== progress.renderedFrames ||
        latest.encodedFrames !== progress.encodedFrames ||
        latest.stitchStage !== progress.stitchStage;
      if (changed) lastChangeAt = timestamp;
      latest = progress;
      const stageChanged = previousStage !== progress.stitchStage;
      previousStage = progress.stitchStage;
      if (stageChanged) writeProgress("phase");
      else if (timestamp - lastLogAt >= intervalMs) writeProgress("interval");
    },
    onDownload(src: string) {
      downloadsStarted += 1;
      const downloadStartedAt = now();
      let completed = false;
      return ({
        percent: downloadedPercent,
        downloaded,
        totalSize,
      }: {
        percent: number | null;
        downloaded: number;
        totalSize: number | null;
      }) => {
        if (completed || downloadedPercent !== 1) return;
        completed = true;
        downloadsCompleted += 1;
        downloadedBytes += downloaded;
        const duration = now() - downloadStartedAt;
        if (downloaded >= 1024 * 1024 || duration >= 5_000) {
          log(
            `${prefix} media download completed in ${formatDuration(duration)} ` +
              `${formatMegabytes(downloaded)}/${totalSize === null ? "unknown" : formatMegabytes(totalSize)} ${src}`,
          );
        }
      };
    },
    finish(slowestFrames: SlowFrame[], describeFrame: (frame: number) => string) {
      clearInterval(heartbeat);
      if (latest) writeProgress("phase");
      if (slowestFrames.length > 0) {
        log(
          `${prefix} slowest frames: ${slowestFrames
            .map(({ frame, time }) => `${frame}=${Math.round(time)}ms (${describeFrame(frame)})`)
            .join(", ")}`,
        );
      }
    },
    stop() {
      clearInterval(heartbeat);
    },
  };
}
