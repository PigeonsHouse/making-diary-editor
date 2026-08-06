import { z } from "zod";

export const voiceSettingsSchema = z.object({
  styleName: z.string().min(1).default("ノーマル"),
  speed: z.number().positive().default(1),
  pitch: z.number().default(0),
  intonation: z.number().nonnegative().default(1),
  volume: z.number().nonnegative().default(1),
});

export const voiceOverridesSchema = z.object({
  styleName: z.string().min(1).optional(),
  speed: z.number().positive().optional(),
  pitch: z.number().optional(),
  intonation: z.number().nonnegative().optional(),
  volume: z.number().nonnegative().optional(),
});

export const characterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  voicevoxName: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  personality: z.string().default(""),
  creditIds: z.array(z.string()).default([]),
  defaultPauseBeforeSeconds: z.number().default(0.25),
  voice: voiceSettingsSchema,
  psdAssetId: z.string().uuid().nullable().default(null),
  psdDefaults: z.record(z.string(), z.string()).default({}),
  psdFilterOrder: z.array(z.string()).default([]),
  psdFilters: z
    .record(
      z.string(),
      z.object({
        targets: z.array(z.string()),
        choiceOrder: z.array(z.string()).default([]),
        choices: z.record(
          z.string(),
          z.object({
            show: z.array(z.string()),
            hide: z.array(z.string()).optional(),
          }),
        ),
      }),
    )
    .default({}),
  avatar: z.object({
    scale: z.number().positive().default(1),
    edgeOffsetXPx: z.number().default(0),
    peekYPx: z.number().nonnegative().default(180),
    previewUrl: z.string().nullable().default(null),
  }),
});

export const dialogueSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  text: z.string().min(1),
  kana: z.string().nullable().default(null),
  pauseBeforeSeconds: z.number().nullable().default(null),
  voiceOverrides: voiceOverridesSchema.default({}),
  psdOverrides: z.record(z.string(), z.string()).default({}),
  audio: z.object({
    status: z.enum(["idle", "generating", "ready", "error"]).default("idle"),
    url: z.string().nullable().default(null),
    durationSeconds: z.number().positive().nullable().default(null),
    error: z.string().nullable().default(null),
    inputHash: z.string().nullable().default(null),
  }),
});

export const assetSettingsSchema = z.object({
  assetId: z.string().uuid(),
  type: z.enum(["image", "video"]),
  url: z.string(),
  displayArea: z.enum(["full", "above-dialogue"]).default("full"),
  sourceDurationSeconds: z.number().positive().nullable().default(null),
  trim: z.object({
    top: z.number().nonnegative().default(0),
    right: z.number().nonnegative().default(0),
    bottom: z.number().nonnegative().default(0),
    left: z.number().nonnegative().default(0),
  }),
  startSeconds: z.number().nonnegative().default(0),
  endSeconds: z.number().positive().nullable().default(null),
  volume: z.number().min(0).default(1),
  shortageMode: z.enum(["loop", "freeze", "fade-out", "fit-duration"]).default("freeze"),
  fadeOutSeconds: z.number().positive().nullable().default(null),
});

export const audioClipSchema = z.object({
  assetId: z.string().uuid(),
  url: z.string(),
  volume: z.number().min(0).max(2).default(1),
});

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

export const projectDocumentSchema = z.object({
  name: z.string().min(1),
  audio: projectAudioSettingsSchema.default({ bgm: null, sceneIntroSe: null, contentSe: null }),
  characterIds: z.array(z.string().uuid()).default([]),
  characterAvatarOverrides: z
    .record(
      z.string(),
      z.object({
        edgeOffsetXPx: z.number().optional(),
        peekYPx: z.number().nonnegative().optional(),
        flipHorizontal: z.boolean().optional(),
      }),
    )
    .default({}),
  wishList: wishListSchema.nullable().default(null),
  diaries: z.array(diaryEntrySchema).default([]),
});

export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Dialogue = z.infer<typeof dialogueSchema>;
export type AssetSettings = z.infer<typeof assetSettingsSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type AudioOverride = z.infer<typeof audioOverrideSchema>;
export type SoundEffectOverride = z.infer<typeof soundEffectOverrideSchema>;
export type ProjectAudioSettings = z.infer<typeof projectAudioSettingsSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export type ProjectRecord = {
  id: string;
  revision: number;
  document: ProjectDocument;
  createdAt: string;
  updatedAt: string;
};
