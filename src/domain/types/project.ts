import { z } from "zod";
import { diaryEntrySchema, projectAudioSettingsSchema, wishListSchema } from "./media";
import { supportCreditsSchema } from "./support";
import { thumbnailSchema } from "./thumbnail";

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
  thumbnail: thumbnailSchema.default({ elements: [] }),
  wishList: wishListSchema.nullable().default(null),
  diaries: z.array(diaryEntrySchema).default([]),
  supportCredits: supportCreditsSchema.default({
    narratorCharacterId: null,
    videos: [],
    bgm: { mode: "inherit" },
    sceneIntroSe: { mode: "inherit" },
    cache: null,
    narrations: [],
  }),
});

export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export type ProjectRecord = {
  id: string;
  revision: number;
  document: ProjectDocument;
  createdAt: string;
  updatedAt: string;
};
