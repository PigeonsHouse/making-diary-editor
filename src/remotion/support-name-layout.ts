export const SUPPORT_LIST_VIEWPORT_HEIGHT = 627;
export const SUPPORT_NAME_MIN_FONT_SIZE = 32;
export const SUPPORT_NAME_MAX_FONT_SIZE = 93;
export const SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE = 56;
export const SUPPORT_NAME_MIN_SCROLL_PX_PER_FRAME = 2;

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
  columns: number;
  scroll: boolean;
};

const adOnlyLayout = (count: number): SupportNameLayout => {
  const fits = (columns: number, fontSize: number) =>
    Math.ceil(count / columns) * rowHeightFor(fontSize) <= SUPPORT_LIST_VIEWPORT_HEIGHT;
  const fitFontSize = (columns: number, maximum: number, minimum: number) => {
    let fontSize = maximum;
    while (fontSize > minimum && !fits(columns, fontSize)) fontSize -= 1;
    return fontSize;
  };

  if (fits(1, SUPPORT_NAME_MAX_FONT_SIZE)) {
    return {
      fontSize: SUPPORT_NAME_MAX_FONT_SIZE,
      rowHeight: rowHeightFor(SUPPORT_NAME_MAX_FONT_SIZE),
      columns: 1,
      scroll: false,
    };
  }
  if (fits(2, SUPPORT_NAME_MAX_FONT_SIZE)) {
    return {
      fontSize: SUPPORT_NAME_MAX_FONT_SIZE,
      rowHeight: rowHeightFor(SUPPORT_NAME_MAX_FONT_SIZE),
      columns: 2,
      scroll: false,
    };
  }

  const twoColumnFontSize = fitFontSize(2, SUPPORT_NAME_MAX_FONT_SIZE, SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE);
  if (fits(2, twoColumnFontSize)) {
    return { fontSize: twoColumnFontSize, rowHeight: rowHeightFor(twoColumnFontSize), columns: 2, scroll: false };
  }
  if (fits(3, SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE)) {
    return {
      fontSize: SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE,
      rowHeight: rowHeightFor(SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE),
      columns: 3,
      scroll: false,
    };
  }

  const threeColumnFontSize = fitFontSize(3, SUPPORT_NAME_COLUMN_BREAK_FONT_SIZE, SUPPORT_NAME_MIN_FONT_SIZE);
  if (fits(3, threeColumnFontSize)) {
    return { fontSize: threeColumnFontSize, rowHeight: rowHeightFor(threeColumnFontSize), columns: 3, scroll: false };
  }
  return {
    fontSize: SUPPORT_NAME_MIN_FONT_SIZE,
    rowHeight: rowHeightFor(SUPPORT_NAME_MIN_FONT_SIZE),
    columns: 3,
    scroll: true,
  };
};

export function getSupportNameScrollOffset(frame: number, durationFrames: number, overflow: number): number {
  if (overflow <= 0) return 0;
  const lastFrame = Math.max(1, durationFrames - 1);
  const naturalSpeed = overflow / lastFrame;
  const speed = Math.max(naturalSpeed, SUPPORT_NAME_MIN_SCROLL_PX_PER_FRAME);
  return Math.min(overflow, Math.max(0, frame) * speed);
}

export function getSupportNameLayout(count: number, kind: "gift" | "ad", isAdOnly = false): SupportNameLayout {
  if (kind === "ad" && isAdOnly) return adOnlyLayout(count);

  const maximumRowHeight = rowHeightFor(SUPPORT_NAME_MAX_FONT_SIZE);
  const maximumOverflow = count * maximumRowHeight - SUPPORT_LIST_VIEWPORT_HEIGHT;
  if (kind === "gift" && maximumOverflow <= 0) {
    return { fontSize: SUPPORT_NAME_MAX_FONT_SIZE, rowHeight: maximumRowHeight, columns: 1, scroll: false };
  }

  const fitAllFontSize = fittedFontSizeFor(count);
  const fitsAtMinimum = rowHeightFor(SUPPORT_NAME_MIN_FONT_SIZE) * count <= SUPPORT_LIST_VIEWPORT_HEIGHT;
  if (fitsAtMinimum && (kind === "ad" || maximumOverflow < maximumRowHeight * 2)) {
    const fontSize = Math.max(SUPPORT_NAME_MIN_FONT_SIZE, fitAllFontSize);
    return { fontSize, rowHeight: rowHeightFor(fontSize), columns: 1, scroll: false };
  }

  const visibleRows = Math.max(1, count - 2);
  const fontSize = Math.max(
    SUPPORT_NAME_MIN_FONT_SIZE,
    Math.min(SUPPORT_NAME_MAX_FONT_SIZE, Math.floor(SUPPORT_LIST_VIEWPORT_HEIGHT / (visibleRows * LINE_HEIGHT_RATIO))),
  );
  return { fontSize, rowHeight: rowHeightFor(fontSize), columns: 1, scroll: true };
}
