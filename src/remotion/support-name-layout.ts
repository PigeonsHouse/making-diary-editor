export const SUPPORT_LIST_VIEWPORT_HEIGHT = 627;
export const SUPPORT_NAME_MIN_FONT_SIZE = 32;
export const SUPPORT_NAME_MAX_FONT_SIZE = 93;

const LINE_HEIGHT_RATIO = 1.33;
const rowHeightFor = (fontSize: number) => Math.ceil(fontSize * LINE_HEIGHT_RATIO);
const fittedFontSizeFor = (count: number) => {
  let fontSize = Math.min(
    SUPPORT_NAME_MAX_FONT_SIZE,
    Math.floor(SUPPORT_LIST_VIEWPORT_HEIGHT / (Math.max(1, count) * LINE_HEIGHT_RATIO)),
  );
  while (fontSize > SUPPORT_NAME_MIN_FONT_SIZE && rowHeightFor(fontSize) * count > SUPPORT_LIST_VIEWPORT_HEIGHT) {
    fontSize -= 1;
  }
  return fontSize;
};

export type SupportNameLayout = {
  fontSize: number;
  rowHeight: number;
  scroll: boolean;
};

export function getSupportNameLayout(count: number, kind: "gift" | "ad"): SupportNameLayout {
  const maximumRowHeight = rowHeightFor(SUPPORT_NAME_MAX_FONT_SIZE);
  const maximumOverflow = count * maximumRowHeight - SUPPORT_LIST_VIEWPORT_HEIGHT;
  if (kind === "gift" && maximumOverflow <= 0) {
    return { fontSize: SUPPORT_NAME_MAX_FONT_SIZE, rowHeight: maximumRowHeight, scroll: false };
  }

  const fitAllFontSize = fittedFontSizeFor(count);
  const fitsAtMinimum = rowHeightFor(SUPPORT_NAME_MIN_FONT_SIZE) * count <= SUPPORT_LIST_VIEWPORT_HEIGHT;
  if (fitsAtMinimum && (kind === "ad" || maximumOverflow < maximumRowHeight * 2)) {
    const fontSize = Math.max(SUPPORT_NAME_MIN_FONT_SIZE, fitAllFontSize);
    return { fontSize, rowHeight: rowHeightFor(fontSize), scroll: false };
  }

  const visibleRows = Math.max(1, count - 2);
  const fontSize = Math.max(
    SUPPORT_NAME_MIN_FONT_SIZE,
    Math.min(SUPPORT_NAME_MAX_FONT_SIZE, Math.floor(SUPPORT_LIST_VIEWPORT_HEIGHT / (visibleRows * LINE_HEIGHT_RATIO))),
  );
  return { fontSize, rowHeight: rowHeightFor(fontSize), scroll: true };
}
