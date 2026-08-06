import type { Character, ProjectDocument } from "@/domain/types";

export type CharacterRow = {
  id: string;
  revision: number;
  data: Character;
};

export type AssetRow = {
  id: string;
  projectId: string | null;
  kind: "image" | "video" | "audio" | "psd";
  originalName: string;
  status: string;
  metadata: Record<string, unknown>;
  error: string | null;
};

export type EditorTab = "general" | "thumbnail" | "wish" | `diary:${string}`;
export type UpdateProject = (recipe: (draft: ProjectDocument) => void) => void;

export type DialogueDragLocation = {
  diaryId: string;
  blockIndex: number;
  dialogueIndex: number;
};

export type BlockDragLocation = {
  diaryId: string;
  blockIndex: number;
};
