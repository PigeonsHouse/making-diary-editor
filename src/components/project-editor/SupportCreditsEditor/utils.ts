import type { Dialogue, ProjectDocument } from "@/domain/types";

export const VIDEO_ID_PATTERN = /^[a-z]{2}[1-9][0-9]*$/;

export const formatFetchedAt = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));

export const defaultStartDate = (project: ProjectDocument) => {
  const dates = project.diaries
    .map((diary) => diary.date)
    .filter(Boolean)
    .sort();
  if (dates[0]) return dates[0];
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
};

export const invalidateAudio = (dialogue: Dialogue) => {
  dialogue.audio = { status: "generating", url: null, durationSeconds: null, error: null, inputHash: null };
};
