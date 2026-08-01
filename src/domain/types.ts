import {z} from "zod";

export const voiceSettingsSchema = z.object({
  styleName: z.string().min(1).default("ノーマル"),
  speed: z.number().positive().default(1),
  pitch: z.number().default(0),
  intonation: z.number().nonnegative().default(1),
  volume: z.number().nonnegative().default(1),
});

export const characterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  voicevoxName: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  personality: z.string().default(""),
  defaultPauseBeforeSeconds: z.number().default(0.25),
  voice: voiceSettingsSchema,
  psdAssetId: z.string().uuid().nullable().default(null),
  psdDefaults: z.record(z.string(), z.string()).default({}),
  psdFilterOrder: z.array(z.string()).default([]),
  psdFilters: z.record(z.string(), z.object({
    targets: z.array(z.string()),
    choiceOrder: z.array(z.string()).default([]),
    choices: z.record(z.string(), z.object({
      show: z.array(z.string()),
      hide: z.array(z.string()).optional(),
    })),
  })).default({}),
  avatar: z.object({
    scale: z.number().positive().default(1),
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
    previewUrl: z.string().nullable().default(null),
  }),
});

export const dialogueSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  text: z.string().min(1),
  kana: z.string().nullable().default(null),
  pauseBeforeSeconds: z.number().nullable().default(null),
  voiceOverrides: voiceSettingsSchema.partial().default({}),
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

export const contentBlockSchema = z.object({
  id: z.string().uuid(),
  title: z.string().default(""),
  asset: assetSettingsSchema.nullable().default(null),
  dialogues: z.array(dialogueSchema).default([]),
  durationSeconds: z.number().positive().nullable().default(null),
  endHoldSeconds: z.number().nonnegative().nullable().default(null),
});

export const diaryEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().date(),
  subtitle: z.string().default(""),
  blocks: z.array(contentBlockSchema).default([]),
});

export const wishListSchema = z.object({
  markdown: z.string().default("- 作りたいもの"),
  dialogues: z.array(dialogueSchema).default([]),
  durationSeconds: z.number().positive().nullable().default(null),
});

export const projectDocumentSchema = z.object({
  name: z.string().min(1),
  characterIds: z.array(z.string().uuid()).default([]),
  avatarLayout: z.object({
    peekOffsetPx: z.number().nonnegative().default(180),
  }),
  wishList: wishListSchema.nullable().default(null),
  diaries: z.array(diaryEntrySchema).default([]),
});

export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Dialogue = z.infer<typeof dialogueSchema>;
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
