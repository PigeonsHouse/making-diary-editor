import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { eq } from "drizzle-orm";
import type { Character, ProjectDocument } from "@/domain/types";
import type { AssetTransparencyMap } from "@/domain/asset-transparency";
import { db } from "./db";
import { appSettings, renderJobs } from "./db/schema";

const RENDER_CACHE_VERSION = "diary-video-h264-crf15-v2";
const RENDER_IMPLEMENTATION_VERSION = "remotion-media-chroma-key-v6";
const CACHE_KEY_PREFIX = "render-cache:";

type RenderCacheEntry = {
  jobId: string;
  outputPath: string;
};

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export function createRenderSignature(
  project: ProjectDocument,
  characters: Character[],
  assetVolumes: Readonly<Record<string, number>> = {},
  assetTransparency: AssetTransparencyMap = {},
) {
  const orderedCharacters = [...characters].sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256")
    .update(RENDER_IMPLEMENTATION_VERSION)
    .update(process.env.RENDER_CACHE_VERSION ?? RENDER_CACHE_VERSION)
    .update(stableSerialize({ project, characters: orderedCharacters, assetVolumes, assetTransparency }))
    .digest("hex");
}

const isRenderCacheEntry = (value: unknown): value is RenderCacheEntry => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.jobId === "string" && typeof entry.outputPath === "string";
};

export async function findCachedRender(signature: string): Promise<RenderCacheEntry | null> {
  const [setting] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, `${CACHE_KEY_PREFIX}${signature}`));
  if (!setting || !isRenderCacheEntry(setting.value)) return null;
  const [job] = await db.select().from(renderJobs).where(eq(renderJobs.id, setting.value.jobId));
  if (job?.status !== "completed" || job.outputPath !== setting.value.outputPath) return null;
  try {
    await access(setting.value.outputPath);
    return setting.value;
  } catch {
    return null;
  }
}

export async function saveCachedRender(signature: string, entry: RenderCacheEntry) {
  await db
    .insert(appSettings)
    .values({ key: `${CACHE_KEY_PREFIX}${signature}`, value: entry })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: entry } });
}
