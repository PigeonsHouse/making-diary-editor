import { z } from "zod";
import { audioOverrideSchema } from "./media";
import { dialogueSchema } from "./voice";

const migrateLegacyCachePeriod = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const cache = value as Record<string, unknown>;
  if (!Array.isArray(cache.videos)) return value;
  const startDate = typeof cache.startDate === "string" ? cache.startDate : null;
  return {
    ...cache,
    videos: cache.videos.map((video) =>
      video && typeof video === "object" && !Array.isArray(video) && !("startDate" in video)
        ? { ...video, startDate }
        : video,
    ),
  };
};

export const supportCreditsCacheSchema = z.preprocess(
  migrateLegacyCachePeriod,
  z.object({
    fetchedAt: z.string().datetime(),
    videos: z.array(
      z.object({
        videoId: z.string().regex(/^[a-z]{2}[1-9][0-9]*$/),
        startDate: z.string().date().nullable(),
        title: z.string().min(1),
        thumbnailUrl: z.string().url(),
        ownerName: z.string().default(""),
        advertisers: z.array(
          z.object({
            supporterId: z.number().int().nullable(),
            supporterName: z.string().min(1),
            totalPoint: z.number().nonnegative(),
          }),
        ),
        gifts: z.array(
          z.object({
            id: z.number().int(),
            supporterId: z.number().int().nullable(),
            supporterName: z.string().min(1),
            publishedAt: z.number().int(),
          }),
        ),
      }),
    ),
  }),
);

export const supportVideoConfigSchema = z.object({
  videoId: z.string().regex(/^[a-z]{2}[1-9][0-9]*$/),
  startDate: z.string().date().nullable().default(null),
});

const migrateLegacySupportCredits = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const credits = value as Record<string, unknown>;
  const migrated = { ...credits };
  if (!Array.isArray(credits.videos)) {
    const videoIds = Array.isArray(credits.videoIds) ? credits.videoIds : [];
    const startDate = typeof credits.startDate === "string" ? credits.startDate : null;
    migrated.videos = videoIds.map((videoId) => ({ videoId, startDate }));
  }
  if (Array.isArray(credits.narrations)) {
    const replacements = new Map([
      ["ご覧の皆様に支えられております。", "ご覧の皆様に支えていただきました。"],
      ["に支えられております。", "に支えていただきました。"],
    ]);
    migrated.narrations = credits.narrations.map((narration) => {
      if (!narration || typeof narration !== "object" || Array.isArray(narration)) return narration;
      const item = narration as Record<string, unknown>;
      const text = typeof item.text === "string" ? replacements.get(item.text) : undefined;
      if (!text || typeof item.key !== "string" || !item.key.endsWith(":ending")) return narration;
      return {
        ...item,
        text,
        kana: null,
        audio: { status: "idle", url: null, durationSeconds: null, error: null, inputHash: null },
      };
    });
  }
  return migrated;
};

export const supportNarrationSchema = dialogueSchema.extend({
  key: z.string().min(1),
});

export const supportCreditsSchema = z.preprocess(
  migrateLegacySupportCredits,
  z.object({
    narratorCharacterId: z.string().uuid().nullable().default(null),
    videos: z.array(supportVideoConfigSchema).default([]),
    bgm: audioOverrideSchema.default({ mode: "inherit" }),
    sceneIntroSe: audioOverrideSchema.default({ mode: "inherit" }),
    cache: supportCreditsCacheSchema.nullable().default(null),
    narrations: z.array(supportNarrationSchema).default([]),
  }),
);

export type SupportVideoConfig = z.infer<typeof supportVideoConfigSchema>;
export type SupportCreditsCache = z.infer<typeof supportCreditsCacheSchema>;
export type SupportNarration = z.infer<typeof supportNarrationSchema>;
export type SupportCredits = z.infer<typeof supportCreditsSchema>;
