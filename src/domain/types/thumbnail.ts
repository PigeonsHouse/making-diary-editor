import { z } from "zod";

export const thumbnailEffectSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("background"), color: z.string(), padding: z.number().nonnegative() }),
  z.object({ id: z.string(), type: z.literal("outline"), color: z.string(), width: z.number().nonnegative() }),
  z.object({
    id: z.string(),
    type: z.literal("shadow"),
    color: z.string(),
    x: z.number(),
    y: z.number(),
    blur: z.number().nonnegative(),
  }),
  z.object({ id: z.string(), type: z.literal("border-radius"), radius: z.number().nonnegative() }),
]);

const thumbnailTransformSchema = z.object({
  x: z.number().default(960),
  y: z.number().default(540),
  anchor: z
    .enum([
      "top-left",
      "top-center",
      "top-right",
      "center-left",
      "center",
      "center-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ])
    .default("center"),
  rotation: z.number().default(0),
  scale: z.number().positive().default(1),
  effects: z.array(thumbnailEffectSchema).default([]),
});

const thumbnailElementValueSchema = z.discriminatedUnion("type", [
  thumbnailTransformSchema.extend({
    id: z.string().uuid(),
    type: z.literal("character"),
    characterId: z.string().uuid(),
    psdOverrides: z.record(z.string(), z.string()).default({}),
  }),
  thumbnailTransformSchema.extend({
    id: z.string().uuid(),
    type: z.literal("asset"),
    assetId: z.string().uuid(),
    timeSeconds: z.number().nonnegative().default(0),
  }),
  thumbnailTransformSchema.extend({
    id: z.string().uuid(),
    type: z.literal("text"),
    text: z.string().default("テキスト"),
    textAlign: z.enum(["left", "center", "right"]).default("center"),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#ffffff"),
    fontSize: z.number().positive().default(120),
  }),
]);

export const thumbnailElementSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const element = value as Record<string, unknown>;
  if (element.type !== "text" || element.effects !== undefined || !Array.isArray(element.outlines)) return value;
  return {
    ...element,
    effects: element.outlines.map((outline, index) => ({
      ...(outline as object),
      id: `legacy-outline-${index}`,
      type: "outline",
    })),
  };
}, thumbnailElementValueSchema);

export const thumbnailSchema = z.object({
  elements: z.array(thumbnailElementSchema).default([]),
});

export type ThumbnailElement = z.infer<typeof thumbnailElementSchema>;
export type ThumbnailEffect = z.infer<typeof thumbnailEffectSchema>;
export type Thumbnail = z.infer<typeof thumbnailSchema>;
