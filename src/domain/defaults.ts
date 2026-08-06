import type { Character, ContentBlock, Dialogue, DiaryEntry, ProjectDocument } from "./types";
import { createId } from "./id";

export const EDITOR_CONSTANTS = {
  fps: 30,
  width: 1920,
  height: 1080,
  dateCenterSeconds: 0.8,
  diaryUiFadeSeconds: 0.3,
  defaultBlockEndHoldSeconds: 0.5,
  mediaMarginPx: 32,
  defaultFadeOutSeconds: 0.5,
  minSubtitleFontPx: 34,
  subtitleFontPx: 58,
} as const;

export const createDialogue = (characterId: string): Dialogue => ({
  id: createId(),
  characterId,
  text: "新しいセリフ",
  kana: null,
  pauseBeforeSeconds: null,
  voiceOverrides: {},
  psdOverrides: {},
  audio: {
    status: "idle",
    url: null,
    durationSeconds: null,
    error: null,
    inputHash: null,
  },
});

export const createBlock = (): ContentBlock => ({
  id: createId(),
  title: "",
  asset: null,
  dialogues: [],
  durationSeconds: 3,
  endHoldSeconds: null,
  entrySe: { mode: "inherit" },
});

export const createDiary = (): DiaryEntry => ({
  id: createId(),
  date: new Date().toISOString().slice(0, 10),
  subtitle: "",
  blocks: [createBlock()],
  sceneIntroSe: { mode: "inherit" },
  bgm: { mode: "inherit" },
});

export const createProject = (name = "新しい製作日誌"): ProjectDocument => ({
  name,
  audio: { bgm: null, sceneIntroSe: null, contentSe: null },
  characterIds: [],
  characterAvatarOverrides: {},
  thumbnail: { elements: [] },
  wishList: null,
  diaries: [],
});

export const createCharacter = (): Character => ({
  id: createId(),
  name: "新しいキャラクター",
  voicevoxName: "ずんだもん",
  color: "#5b8def",
  personality: "",
  creditIds: [],
  defaultPauseBeforeSeconds: 0.25,
  voice: { styleName: "ノーマル", speed: 1, pitch: 0, intonation: 1, volume: 1 },
  psdAssetId: null,
  psdDefaults: {},
  psdFilterOrder: [],
  psdFilters: {},
  avatar: { scale: 1, edgeOffsetXPx: 0, peekYPx: 180, previewUrl: null },
});
