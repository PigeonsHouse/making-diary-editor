import { z } from "zod";
import { dialogueSchema } from "./voice";

const migrateLegacyVolumeOverride = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, "volumeOverride")) return value;
  const { volume, ...rest } = record;
  return {
    ...rest,
    volumeOverride: typeof volume === "number" && Number.isFinite(volume) && volume !== 1 ? volume : null,
  };
};

const migrateLegacyChromaKey = (value: unknown) => {
  const volumeMigrated = migrateLegacyVolumeOverride(value);
  if (!volumeMigrated || typeof volumeMigrated !== "object" || Array.isArray(volumeMigrated)) return volumeMigrated;
  const record = volumeMigrated as Record<string, unknown>;
  const chromaKey = record.chromaKey;
  if (!chromaKey || typeof chromaKey !== "object" || Array.isArray(chromaKey)) return volumeMigrated;
  const settings = chromaKey as Record<string, unknown>;
  if (Object.hasOwn(settings, "edgeBlur") || !Object.hasOwn(settings, "smoothness")) return volumeMigrated;
  const legacySmoothness = typeof settings.smoothness === "number" ? settings.smoothness : 0.08;
  const { smoothness: _smoothness, ...rest } = settings;
  return {
    ...record,
    chromaKey: {
      ...rest,
      edgeBlur: Math.min(100, Math.max(0, legacySmoothness * 25)),
    },
  };
};

export const assetSettingsSchema = z.preprocess(
  migrateLegacyChromaKey,
  z.object({
    assetId: z.string().uuid(),
    type: z.enum(["image", "video"]),
    url: z.string(),
    displayArea: z.enum(["full", "above-dialogue"]).default("full"),
    sourceWidth: z.number().positive().nullable().default(null),
    sourceHeight: z.number().positive().nullable().default(null),
    sourceDurationSeconds: z.number().positive().nullable().default(null),
    trim: z.object({
      top: z.number().nonnegative().default(0),
      right: z.number().nonnegative().default(0),
      bottom: z.number().nonnegative().default(0),
      left: z.number().nonnegative().default(0),
    }),
    chromaKey: z
      .object({
        enabled: z.boolean().default(false),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#00ff00"),
        similarity: z.number().min(0).max(1).default(0.15),
        edgeBlur: z.number().min(0).max(100).default(2),
      })
      .default({ enabled: false, color: "#00ff00", similarity: 0.15, edgeBlur: 2 }),
    startSeconds: z.number().nonnegative().default(0),
    endSeconds: z.number().positive().nullable().default(null),
    volumeOverride: z.number().min(0).nullable().default(null),
    shortageMode: z.enum(["loop", "freeze", "fade-out", "fit-duration"]).default("freeze"),
    fadeOutSeconds: z.number().positive().nullable().default(null),
  }),
);

export const audioClipSchema = z.preprocess(
  migrateLegacyVolumeOverride,
  z.object({
    assetId: z.string().uuid(),
    url: z.string(),
    volumeOverride: z.number().min(0).nullable().default(null),
  }),
);

export const audioOverrideSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("inherit") }),
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("custom"), clip: audioClipSchema }),
]);

export const soundEffectOverrideSchema = audioOverrideSchema;

const migrateRenamedField = (value: unknown, oldKey: string, newKey: string) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record[newKey] !== undefined || record[oldKey] === undefined) return value;
  return { ...record, [newKey]: record[oldKey] };
};

export const projectAudioSettingsSchema = z.preprocess(
  (value) => migrateRenamedField(value, "dateSe", "sceneIntroSe"),
  z.object({
    bgm: audioClipSchema.nullable().default(null),
    sceneIntroSe: audioClipSchema.nullable().default(null),
    contentSe: audioClipSchema.nullable().default(null),
  }),
);

export const contentBlockSchema = z.object({
  id: z.string().uuid(),
  title: z.string().default(""),
  asset: assetSettingsSchema.nullable().default(null),
  dialogues: z.array(dialogueSchema).default([]),
  durationSeconds: z.number().positive().nullable().default(null),
  endHoldSeconds: z.number().nonnegative().nullable().default(null),
  bgmMuted: z.boolean().default(false),
  entrySe: soundEffectOverrideSchema.default({ mode: "inherit" }),
});

export const diaryEntrySchema = z.preprocess(
  (value) => migrateRenamedField(value, "dateSe", "sceneIntroSe"),
  z.object({
    id: z.string().uuid(),
    date: z.string().date(),
    subtitle: z.string().default(""),
    blocks: z.array(contentBlockSchema).default([]),
    sceneIntroSe: audioOverrideSchema.default({ mode: "inherit" }),
    bgm: audioOverrideSchema.default({ mode: "inherit" }),
  }),
);

export const wishListSchema = z.object({
  markdown: z.string().default("- 作りたいもの"),
  dialogues: z.array(dialogueSchema).default([]),
  durationSeconds: z.number().positive().nullable().default(null),
  endHoldSeconds: z.number().nonnegative().nullable().default(null),
  sceneIntroSe: audioOverrideSchema.default({ mode: "inherit" }),
  bgm: audioOverrideSchema.default({ mode: "inherit" }),
});

export type AssetSettings = z.infer<typeof assetSettingsSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type AudioOverride = z.infer<typeof audioOverrideSchema>;
export type SoundEffectOverride = z.infer<typeof soundEffectOverrideSchema>;
export type ProjectAudioSettings = z.infer<typeof projectAudioSettingsSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
