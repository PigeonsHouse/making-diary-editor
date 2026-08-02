import type {DialogueDragLocation} from "./types";

export const DIALOGUE_DRAG_TYPE = "application/x-making-diary-dialogue";
export const WISH_LIST_DIALOGUE_SCOPE = "__wish_list__";

export const hasDialogueDragData = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).includes(DIALOGUE_DRAG_TYPE);

export function readDialogueDragData(dataTransfer: DataTransfer, diaryId: string): DialogueDragLocation | null {
  try {
    const value = JSON.parse(dataTransfer.getData(DIALOGUE_DRAG_TYPE)) as Partial<DialogueDragLocation>;
    if (value.diaryId !== diaryId || !Number.isInteger(value.blockIndex) || !Number.isInteger(value.dialogueIndex)) {
      return null;
    }
    return value as DialogueDragLocation;
  } catch {
    return null;
  }
}
