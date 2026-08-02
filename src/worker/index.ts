import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { createDialoguePsdPreviewSpecs } from "@/domain/psd-previews";
import { db } from "@/server/db";
import { assets, characters, renderJobs } from "@/server/db/schema";
import { renderPsdPreview } from "@/server/psd";
import { redis } from "@/server/queue";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const rendersDir = path.join(dataDir, "renders");

function resolveAssetUrls<T>(value: T): T {
  const appUrl = process.env.APP_URL ?? "http://app:3000";
  if (typeof value === "string") {
    return (value.startsWith("/api/") ? `${appUrl}${value}` : value) as T;
  }
  if (Array.isArray(value)) return value.map(resolveAssetUrls) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssetUrls(item)])) as T;
  }
  return value;
}

let serveUrlPromise: Promise<string> | null = null;
const getServeUrl = () => {
  serveUrlPromise ??= bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    webpackOverride: (config) => config,
  });
  return serveUrlPromise;
};

async function main() {
  await mkdir(rendersDir, { recursive: true });

  new Worker(
    "renders",
    async (queueJob) => {
      const renderJobId = queueJob.data.renderJobId as string;
      const [job] = await db.select().from(renderJobs).where(eq(renderJobs.id, renderJobId));
      if (!job) throw new Error("Render job not found");
      const characterRows = await db.select().from(characters);
      const characterData = characterRows.map((row) => row.data);
      const psdPreviewSpecs = createDialoguePsdPreviewSpecs(job.snapshot, characterData);
      const dialoguePsdPreviewUrls: Record<string, string> = {};
      if (psdPreviewSpecs.length > 0) {
        const assetRows = await db.select().from(assets);
        const assetsById = new Map(assetRows.map((asset) => [asset.id, asset]));
        for (const spec of psdPreviewSpecs) {
          const asset = assetsById.get(spec.assetId);
          if (!asset) continue;
          const hash = await renderPsdPreview(
            asset.originalPath,
            spec.filters,
            spec.selections,
            path.join(dataDir, "psd-previews"),
          );
          for (const dialogueId of spec.dialogueIds) {
            dialoguePsdPreviewUrls[dialogueId] = `/api/files/psd/${hash}.png`;
          }
        }
      }
      const inputProps = resolveAssetUrls({
        project: job.snapshot,
        characters: characterData,
        dialoguePsdPreviewUrls,
      });
      const outputPath = path.join(rendersDir, `${renderJobId}.mp4`);
      try {
        await db
          .update(renderJobs)
          .set({ status: "rendering", updatedAt: new Date() })
          .where(eq(renderJobs.id, renderJobId));
        const serveUrl = await getServeUrl();
        const composition = await selectComposition({
          serveUrl,
          id: "DiaryVideo",
          inputProps,
          browserExecutable: process.env.CHROMIUM_PATH,
        });
        await renderMedia({
          serveUrl,
          composition,
          codec: "h264",
          audioCodec: "aac",
          outputLocation: outputPath,
          inputProps,
          browserExecutable: process.env.CHROMIUM_PATH,
          onProgress: async ({ progress }) => {
            const percent = Math.round(progress * 100);
            await queueJob.updateProgress(percent);
            await db
              .update(renderJobs)
              .set({ progress: percent, updatedAt: new Date() })
              .where(eq(renderJobs.id, renderJobId));
          },
        });
        await db
          .update(renderJobs)
          .set({
            status: "completed",
            progress: 100,
            outputPath,
            updatedAt: new Date(),
          })
          .where(eq(renderJobs.id, renderJobId));
      } catch (error) {
        await db
          .update(renderJobs)
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(renderJobs.id, renderJobId));
        throw error;
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
        const extension = asset.kind === "video" ? ".mp4" : ".jpg";
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
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                output,
              ]
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
    },
    { connection: redis, concurrency: 1 },
  );

  console.log("Asset worker started");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
