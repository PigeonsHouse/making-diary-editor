import { z } from "zod";

const VOICEVOX_MORA_PATTERN =
  /イェ|ヴ[ャュョ]|[ウクグトド]ゥ|[テデ][ィェャュョ]|[クグ]ヮ|[キシチニヒミリギジヂビピ][ェャュョ]|[キニヒミリギビピ]ィ|[クツフヴグ]ァ|[ウクスツフヴグズ]ィ|[ウクツフヴグ][ェォ]|[ァ-ヴー]/gu;
const SUTEGANA = ["ァ", "ィ", "ゥ", "ェ", "ォ", "ャ", "ュ", "ョ", "ヮ", "ッ"] as const;
const SUTEGANA_WITHOUT_SOKUON = new Set<string>(SUTEGANA.slice(0, -1));

export const VOICEVOX_WORD_TYPES = [
  { value: "PROPER_NOUN", label: "固有名詞" },
  { value: "COMMON_NOUN", label: "普通名詞" },
  { value: "VERB", label: "動詞" },
  { value: "ADJECTIVE", label: "形容詞" },
  { value: "SUFFIX", label: "接尾辞" },
] as const;

export const voicevoxWordTypeSchema = z.enum(["PROPER_NOUN", "COMMON_NOUN", "VERB", "ADJECTIVE", "SUFFIX"]);

export const newVoicevoxUserDictWordSchema = z
  .object({
    surface: z.string().trim().min(1),
    pronunciation: z
      .string()
      .trim()
      .min(1)
      .refine(isValidVoicevoxPronunciation, "読みは有効な全角カタカナで入力してください"),
    accentType: z.number().int().nonnegative(),
    wordType: voicevoxWordTypeSchema,
  })
  .superRefine((word, context) => {
    const moraCount = splitVoicevoxMoras(word.pronunciation).length;
    if (word.accentType > moraCount) {
      context.addIssue({
        code: "custom",
        path: ["accentType"],
        message: `アクセント位置は0〜${moraCount}で指定してください`,
      });
    }
  });

export const voicevoxUserDictWordSchema = z.object({
  surface: z.string(),
  pronunciation: z.string(),
  accent_type: z.number().int(),
  mora_count: z.number().int().optional(),
  priority: z.number().int(),
  part_of_speech: z.string(),
  part_of_speech_detail_1: z.string(),
});

export const voicevoxUserDictSchema = z.record(z.string(), voicevoxUserDictWordSchema);

export type VoicevoxWordType = z.infer<typeof voicevoxWordTypeSchema>;
export type NewVoicevoxUserDictWord = z.infer<typeof newVoicevoxUserDictWordSchema>;
export type VoicevoxUserDictWord = z.infer<typeof voicevoxUserDictWordSchema>;
export type VoicevoxUserDict = z.infer<typeof voicevoxUserDictSchema>;

export function voicevoxPartOfSpeechLabel(word: VoicevoxUserDictWord) {
  const detail = word.part_of_speech_detail_1;
  return detail && detail !== "*" ? `${word.part_of_speech}（${detail}）` : word.part_of_speech;
}

export function voicevoxWordTypeFromWord(word: VoicevoxUserDictWord): VoicevoxWordType {
  if (word.part_of_speech === "動詞") return "VERB";
  if (word.part_of_speech === "形容詞") return "ADJECTIVE";
  if (word.part_of_speech_detail_1 === "接尾") return "SUFFIX";
  if (word.part_of_speech_detail_1 === "一般") return "COMMON_NOUN";
  return "PROPER_NOUN";
}

export function isValidVoicevoxPronunciation(pronunciation: string) {
  if (!/^[ァ-ヴー]+$/u.test(pronunciation)) return false;

  const characters = Array.from(pronunciation);
  for (let index = 0; index < characters.length; index += 1) {
    const current = characters[index];
    const next = characters[index + 1];
    if (
      SUTEGANA.includes(current as (typeof SUTEGANA)[number]) &&
      (SUTEGANA_WITHOUT_SOKUON.has(next) || (current === "ッ" && next === "ッ"))
    ) {
      return false;
    }
    if (current === "ヮ" && index !== 0 && characters[index - 1] !== "ク" && characters[index - 1] !== "グ") {
      return false;
    }
  }
  return true;
}

export function splitVoicevoxMoras(pronunciation: string) {
  if (!isValidVoicevoxPronunciation(pronunciation)) return [];
  return pronunciation.match(VOICEVOX_MORA_PATTERN) ?? [];
}

export function isHighPitchMora(index: number, accentType: number) {
  if (accentType === 0) return index > 0;
  if (accentType === 1) return index === 0;
  return index > 0 && index < accentType;
}
