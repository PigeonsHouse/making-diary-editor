import type { BlockDragLocation } from "./types";

export const BLOCK_DRAG_TYPE = "application/x-making-diary-block";

export const hasBlockDragData = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).includes(BLOCK_DRAG_TYPE);

export function readBlockDragData(dataTransfer: DataTransfer, diaryId: string): BlockDragLocation | null {
  try {
    const value = JSON.parse(dataTransfer.getData(BLOCK_DRAG_TYPE)) as Partial<BlockDragLocation>;
    if (value.diaryId !== diaryId || !Number.isInteger(value.blockIndex)) return null;
    return value as BlockDragLocation;
  } catch {
    return null;
  }
}
