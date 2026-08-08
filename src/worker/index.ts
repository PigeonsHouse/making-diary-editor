import { mkdir, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { makeCancelSignal, openBrowser, renderMedia } from "@remotion/renderer";
import { Worker } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import { EDITOR_CONSTANTS } from "@/domain/defaults";
import { characterSchema, projectDocumentSchema } from "@/domain/types";
import { getVideoDuration } from "@/domain/video-duration";
import { db } from "@/server/db";
import { assets, characters, projects, renderJobs } from "@/server/db/schema";
import { redis } from "@/server/queue";
import { createRenderSignature, saveCachedRender } from "@/server/render-cache";
import {
  clearRenderCancellation,
  isRenderCancellationRequested,
  watchRenderCancellation,
} from "@/server/render-cancellation";
import {
  getGpuVideoBitrate,
  getRenderLogIntervalMs,
  getProgressIntervalMs,
  getOffthreadVideoThreads,
  getRenderConcurrency,
  getRenderMediaCacheSize,
  getRenderTimeoutMs,
  getSoftwareCrf,
  getTimeoutRetryConcurrency,
  getX264Preset,
  isDelayRenderTimeoutError,
} from "./render-config";
import { detectGpuCapabilities, getGpuMode, isHardwareEncodingError, resolveGpuUsage } from "./gpu-runtime";
import { resolveRenderAssetUrls } from "./render-input";
import { getRemotionServeUrl } from "./remotion-bundler";
import { createProgressReporter } from "./render-progress";
import { calculateDetailedRenderProgress } from "./render-progress-value";
import { createRenderDiagnostics } from "./render-diagnostics";
import { createFrameDescription } from "./render-frame-description";
import { createRenderResourceCoordinator } from "./render-resource-coordinator";
import { prepareDialoguePsdPreviews } from "./prepare-psd";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const rendersDir = path.join(dataDir, "renders");

let serveUrlPromise: Promise<string> | null = null;
const getServeUrl = () => {
  serveUrlPromise ??= getRemotionServeUrl();
  return serveUrlPromise;
};

type BrowserRuntime = {
  browser: Awaited<ReturnType<typeof openBrowser>>;
  gpuRendering: boolean;
};

let browserPromise: Promise<BrowserRuntime> | null = null;
const getBrowser = (gpuRendering: boolean, gpuMode: ReturnType<typeof getGpuMode>) => {
  browserPromise ??= (async () => {
    if (gpuRendering) {
      try {
        const browser = await openBrowser("chrome", {
          browserExecutable: null,
          chromeMode: "chrome-for-testing",
          chromiumOptions: { gl: "angle-egl" },
        });
        return { browser, gpuRendering: true };
      } catch (error) {
        if (gpuMode === "required") throw error;
        console.warn("GPU Chromium failed to start; falling back to CPU Chromium", error);
      }
    }
    const browser = await openBrowser("chrome", { browserExecutable: process.env.CHROMIUM_PATH });
    return { browser, gpuRendering: false };
  })();
  return browserPromise;
};

async function main() {
  await mkdir(rendersDir, { recursive: true });
  const gpuMode = getGpuMode();
  const gpuCapabilities = detectGpuCapabilities();
  const gpuUsage = resolveGpuUsage(gpuMode, gpuCapabilities);
  console.log(
    `GPU mode=${gpuMode}, encoding=${gpuUsage.hardwareEncoding}, ` +
      `Chromium=${gpuUsage.chromiumRendering} (${gpuCapabilities.source})`,
  );
  const runtimeWarmup = Promise.all([getServeUrl(), getBrowser(gpuUsage.chromiumRendering, gpuMode)]);
  void runtimeWarmup.then(
    ([, browserRuntime]) =>
      console.log(`Remotion bundle and Chromium warmed up (${browserRuntime.gpuRendering ? "GPU" : "CPU"} rendering)`),
    (error) => console.error("Failed to warm up Remotion runtime", error),
  );
  const renderResources = createRenderResourceCoordinator();

  new Worker(
    "renders",
    async (queueJob) => {
      const renderJobId = queueJob.data.renderJobId as string;
      const [job] = await db.select().from(renderJobs).where(eq(renderJobs.id, renderJobId));
      if (!job) throw new Error("Render job not found");
      const startedAt = performance.now();
      const outputPath = path.join(rendersDir, `${renderJobId}.mp4`);
      const { cancelSignal, cancel } = makeCancelSignal();
      let cancellationObserved = false;
      let releaseRenderResources: (() => void) | null = null;
      const stopWatchingCancellation = watchRenderCancellation(renderJobId, () => {
        cancellationObserved = true;
        cancel();
      });
      const throwIfCancellationRequested = async () => {
        if (cancellationObserved || (await isRenderCancellationRequested(renderJobId))) {
          cancellationObserved = true;
          cancel();
          throw new Error("Render cancellation requested");
        }
      };
      try {
        const [started] = await db
          .update(renderJobs)
          .set({ status: "preparing", progress: 0, etaMs: null, error: null, updatedAt: new Date() })
          .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.status, "queued")))
          .returning({ id: renderJobs.id });
        // キューから取り出す直前に中断されたジョブは実行しない。
        if (!started) {
          await db
            .update(renderJobs)
            .set({ status: "cancelled", etaMs: null, error: null, updatedAt: new Date() })
            .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.status, "cancelling")));
          return;
        }
        await throwIfCancellationRequested();
        const resourceLease = renderResources.reserveRender();
        releaseRenderResources = resourceLease.release;
        if (resourceLease.waitingForBackgroundWork) {
          const waitStartedAt = performance.now();
          console.log(`[render:${renderJobId}] waiting for active background worker job`);
          await resourceLease.ready;
          console.log(
            `[render:${renderJobId}] background worker wait completed in ${Math.round(performance.now() - waitStartedAt)}ms`,
          );
        } else {
          await resourceLease.ready;
        }
        await throwIfCancellationRequested();
        const snapshot = projectDocumentSchema.parse(job.snapshot);
        const queuedCharacters = characterSchema.array().safeParse(queueJob.data.characterData);
        const characterData = queuedCharacters.success
          ? queuedCharacters.data
          : (await db.select().from(characters)).map((row) => row.data);
        const queuedAssetVolumes = queueJob.data.assetVolumes;
        const assetVolumes =
          queuedAssetVolumes && typeof queuedAssetVolumes === "object" && !Array.isArray(queuedAssetVolumes)
            ? Object.fromEntries(
                Object.entries(queuedAssetVolumes).filter(
                  (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]),
                ),
              )
            : Object.fromEntries(
                (await db.select({ id: assets.id, defaultVolume: assets.defaultVolume }).from(assets)).map((asset) => [
                  asset.id,
                  asset.defaultVolume,
                ]),
              );
        const renderSignature =
          typeof queueJob.data.renderSignature === "string"
            ? queueJob.data.renderSignature
            : createRenderSignature(snapshot, characterData, assetVolumes);

        const psdStartedAt = performance.now();
        const dialoguePsdPreviewUrls = await prepareDialoguePsdPreviews(snapshot, characterData, dataDir);
        console.log(`[render:${renderJobId}] PSD preparation ${Math.round(performance.now() - psdStartedAt)}ms`);
        await throwIfCancellationRequested();

        const renderCharacters = characterData.map((character) => {
          const previewUrl = dialoguePsdPreviewUrls[`character:${character.id}`];
          return previewUrl ? { ...character, avatar: { ...character.avatar, previewUrl } } : character;
        });

        const inputProps = resolveRenderAssetUrls({
          project: snapshot,
          characters: renderCharacters,
          dialoguePsdPreviewUrls,
          assetVolumes,
        });
        const [serveUrl, browserRuntime] = await runtimeWarmup;
        await throwIfCancellationRequested();
        const composition = {
          id: "DiaryVideo",
          width: EDITOR_CONSTANTS.width,
          height: EDITOR_CONSTANTS.height,
          fps: EDITOR_CONSTANTS.fps,
          durationInFrames: getVideoDuration(snapshot, characterData),
          defaultProps: {},
          props: inputProps,
          defaultCodec: null,
          defaultOutName: null,
          defaultVideoImageFormat: null,
          defaultPixelFormat: null,
          defaultProResProfile: null,
          defaultSampleRate: null,
        } as const;
        const [rendering] = await db
          .update(renderJobs)
          .set({ status: "rendering", progress: 0, etaMs: null, error: null, updatedAt: new Date() })
          .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.status, "preparing")))
          .returning({ id: renderJobs.id });
        if (!rendering) {
          await db
            .update(renderJobs)
            .set({ status: "cancelled", etaMs: null, error: null, updatedAt: new Date() })
            .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.status, "cancelling")));
          return;
        }
        const progressReporter = createProgressReporter({
          intervalMs: getProgressIntervalMs(),
          persist: async (percent, etaMs) => {
            await Promise.all([
              queueJob.updateProgress(percent),
              db
                .update(renderJobs)
                .set({ progress: percent, etaMs, updatedAt: new Date() })
                .where(eq(renderJobs.id, renderJobId)),
            ]);
          },
        });
        const mediaCacheSizeInBytes = getRenderMediaCacheSize();
        const renderConcurrency = getRenderConcurrency();
        const x264Preset = getX264Preset();
        const softwareCrf = getSoftwareCrf();
        const gpuVideoBitrate = getGpuVideoBitrate();
        const offthreadVideoThreads = getOffthreadVideoThreads();
        const timeoutInMilliseconds = getRenderTimeoutMs();
        const timeoutRetryConcurrency = getTimeoutRetryConcurrency();
        const renderDiagnostics = createRenderDiagnostics({
          renderJobId,
          totalFrames: composition.durationInFrames,
          intervalMs: getRenderLogIntervalMs(),
        });
        const describeFrame = createFrameDescription(snapshot, renderCharacters, composition.fps);
        console.log(
          `[render:${renderJobId}] ${composition.durationInFrames} frames, concurrency=${renderConcurrency}, ` +
            `encoding=${gpuUsage.hardwareEncoding ? `GPU ${gpuVideoBitrate}` : `x264 ${x264Preset} CRF ${softwareCrf}`}, ` +
            `Chromium=${browserRuntime.gpuRendering ? "GPU" : "CPU"}, offthreadVideoThreads=${offthreadVideoThreads}, ` +
            `timeout=${timeoutInMilliseconds}ms`,
        );
        const mediaStartedAt = performance.now();
        const renderWithEncoding = (hardwareEncoding: boolean, concurrency: string | number) =>
          renderMedia({
            serveUrl,
            composition,
            codec: "h264",
            audioCodec: "aac",
            imageFormat: "jpeg",
            pixelFormat: "yuv420p",
            colorSpace: "bt709",
            ...(hardwareEncoding
              ? {
                  hardwareAcceleration: gpuMode === "required" ? ("required" as const) : ("if-possible" as const),
                  videoBitrate: gpuVideoBitrate,
                }
              : { hardwareAcceleration: "disable" as const, crf: softwareCrf, x264Preset }),
            concurrency,
            timeoutInMilliseconds,
            mediaCacheSizeInBytes,
            offthreadVideoCacheSizeInBytes: mediaCacheSizeInBytes,
            offthreadVideoThreads,
            outputLocation: outputPath,
            inputProps,
            cancelSignal,
            puppeteerInstance: browserRuntime.browser,
            onStart: renderDiagnostics.onStart,
            onDownload: renderDiagnostics.onDownload,
            onBrowserLog: (message) => {
              if (message.type === "error" || message.type === "warning") {
                console.warn(`[render:${renderJobId}] browser ${message.type}: ${message.text}`);
              }
            },
            onProgress: (progress) => {
              progressReporter.report(
                calculateDetailedRenderProgress(progress, composition.durationInFrames),
                progress.renderEstimatedTime,
              );
              renderDiagnostics.onProgress(progress);
            },
          });
        let hardwareEncoding = gpuUsage.hardwareEncoding;
        let attemptConcurrency = renderConcurrency;
        let usedHardwareFallback = false;
        let usedTimeoutFallback = false;
        let renderResult: Awaited<ReturnType<typeof renderMedia>> | null = null;
        try {
          while (true) {
            try {
              renderResult = await renderWithEncoding(hardwareEncoding, attemptConcurrency);
              break;
            } catch (error) {
              const cancellationRequested = cancellationObserved || (await isRenderCancellationRequested(renderJobId));
              if (cancellationRequested) throw error;

              if (
                gpuMode !== "required" &&
                hardwareEncoding &&
                !usedHardwareFallback &&
                isHardwareEncodingError(error)
              ) {
                hardwareEncoding = false;
                usedHardwareFallback = true;
                console.warn(`[render:${renderJobId}] GPU encoding failed; retrying with x264`, error);
              } else if (
                !usedTimeoutFallback &&
                isDelayRenderTimeoutError(error) &&
                (typeof attemptConcurrency !== "number" || timeoutRetryConcurrency < attemptConcurrency)
              ) {
                attemptConcurrency = timeoutRetryConcurrency;
                usedTimeoutFallback = true;
                console.warn(
                  `[render:${renderJobId}] delayRender timeout; retrying with concurrency=${timeoutRetryConcurrency}`,
                  error,
                );
              } else {
                throw error;
              }

              await unlink(outputPath).catch((unlinkError: NodeJS.ErrnoException) => {
                if (unlinkError.code !== "ENOENT") throw unlinkError;
              });
            }
          }
        } finally {
          renderDiagnostics.stop();
        }
        renderDiagnostics.finish(renderResult.slowestFrames, describeFrame);
        await throwIfCancellationRequested();
        progressReporter.report(1);
        await progressReporter.flush();
        console.log(`[render:${renderJobId}] media rendering ${Math.round(performance.now() - mediaStartedAt)}ms`);
        const [completed] = await db
          .update(renderJobs)
          .set({
            status: "completed",
            progress: 100,
            etaMs: null,
            outputPath,
            updatedAt: new Date(),
          })
          .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.status, "rendering")))
          .returning({ id: renderJobs.id });
        if (!completed) {
          await unlink(outputPath).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          });
          await db
            .update(renderJobs)
            .set({ status: "cancelled", etaMs: null, error: null, updatedAt: new Date() })
            .where(and(eq(renderJobs.id, renderJobId), eq(renderJobs.status, "cancelling")));
          return;
        }
        await saveCachedRender(renderSignature, { jobId: renderJobId, outputPath }).catch((error) =>
          console.error(`[render:${renderJobId}] Failed to save render cache`, error),
        );
        console.log(`[render:${renderJobId}] completed in ${Math.round(performance.now() - startedAt)}ms`);
      } catch (error) {
        const wasCancelled = cancellationObserved || (await isRenderCancellationRequested(renderJobId));
        if (wasCancelled) {
          await unlink(outputPath).catch((unlinkError: NodeJS.ErrnoException) => {
            if (unlinkError.code !== "ENOENT")
              console.error(`[render:${renderJobId}] Failed to remove partial output`, unlinkError);
          });
          await db
            .update(renderJobs)
            .set({ status: "cancelled", etaMs: null, error: null, updatedAt: new Date() })
            .where(
              and(
                eq(renderJobs.id, renderJobId),
                inArray(renderJobs.status, ["queued", "preparing", "rendering", "cancelling"]),
              ),
            );
          console.log(`[render:${renderJobId}] cancelled`);
          return;
        }
        await db
          .update(renderJobs)
          .set({
            status: "failed",
            etaMs: null,
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(and(eq(renderJobs.id, renderJobId), inArray(renderJobs.status, ["queued", "preparing", "rendering"])));
        throw error;
      } finally {
        releaseRenderResources?.();
        stopWatchingCancellation();
        await clearRenderCancellation(renderJobId).catch((error) =>
          console.error(`[render:${renderJobId}] Failed to clear cancellation`, error),
        );
      }
    },
    { connection: redis, concurrency: 1 },
  );

  console.log("Render worker started");

  const execFileAsync = promisify(execFile);
  const normalizedDir = path.join(dataDir, "normalized");
  await mkdir(normalizedDir, { recursive: true });

  new Worker(
    "assets",
    async (queueJob) => {
      if (renderResources.isRenderReserved()) {
        console.log(`[asset-job:${queueJob.name}] waiting until rendering is idle`);
      }
      await renderResources.runBackgroundWork(async () => {
        if (queueJob.name === "prepare-project-psd") {
          const projectId = queueJob.data.projectId as string;
          const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
          if (!project) return;
          const snapshot = projectDocumentSchema.parse(project.document);
          const selectedIds = new Set(snapshot.characterIds);
          const characterData = (await db.select().from(characters))
            .map((row) => row.data)
            .filter((character) => selectedIds.has(character.id));
          const startedAt = performance.now();
          await prepareDialoguePsdPreviews(snapshot, characterData, dataDir);
          console.log(`[prepare:${projectId}] PSD previews ready in ${Math.round(performance.now() - startedAt)}ms`);
          return;
        }
        const assetId = queueJob.data.assetId as string;
        const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
        if (!asset) throw new Error("Asset not found");
        try {
          if (asset.kind === "psd") {
            await db
              .update(assets)
              .set({
                normalizedPath: asset.originalPath,
                status: "ready",
              })
              .where(eq(assets.id, assetId));
            return;
          }
          const extension = asset.kind === "video" ? ".mp4" : asset.kind === "audio" ? ".m4a" : ".jpg";
          const output = path.join(normalizedDir, `${asset.id}${extension}`);
          const args =
            asset.kind === "video"
              ? [
                  "-y",
                  "-i",
                  asset.originalPath,
                  "-map_metadata",
                  "0",
                  "-c:v",
                  "libx264",
                  "-preset",
                  "veryfast",
                  "-g",
                  String(EDITOR_CONSTANTS.fps),
                  "-keyint_min",
                  String(EDITOR_CONSTANTS.fps),
                  "-sc_threshold",
                  "0",
                  "-pix_fmt",
                  "yuv420p",
                  "-c:a",
                  "aac",
                  "-movflags",
                  "+faststart",
                  output,
                ]
              : asset.kind === "audio"
                ? ["-y", "-i", asset.originalPath, "-map_metadata", "0", "-vn", "-c:a", "aac", "-b:a", "192k", output]
                : ["-y", "-i", asset.originalPath, "-map_metadata", "0", "-q:v", "2", output];
          await execFileAsync("ffmpeg", args);
          const { stdout } = await execFileAsync("ffprobe", [
            "-v",
            "error",
            "-show_entries",
            "stream=width,height,duration:format=duration",
            "-of",
            "json",
            output,
          ]);
          await db
            .update(assets)
            .set({
              normalizedPath: output,
              status: "ready",
              metadata: JSON.parse(stdout),
              error: null,
            })
            .where(eq(assets.id, assetId));
        } catch (error) {
          await db
            .update(assets)
            .set({
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            })
            .where(eq(assets.id, assetId));
          throw error;
        }
      });
    },
    { connection: redis, concurrency: 1 },
  );

  console.log("Asset worker started");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
