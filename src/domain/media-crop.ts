export type MediaTrim = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CroppedMediaLayout = {
  viewportWidth: number;
  viewportHeight: number;
  mediaWidth: number;
  mediaHeight: number;
  mediaLeft: number;
  mediaTop: number;
};

const finiteNonnegative = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

export function getMaximumTrim(side: keyof MediaTrim, trim: MediaTrim, sourceWidth: number, sourceHeight: number) {
  const horizontal = side === "left" || side === "right";
  const sourceSize = horizontal ? sourceWidth : sourceHeight;
  const opposite = horizontal ? (side === "left" ? trim.right : trim.left) : side === "top" ? trim.bottom : trim.top;
  return Math.max(0, sourceSize - finiteNonnegative(opposite) - 1);
}

export function calculateCroppedMediaLayout({
  sourceWidth,
  sourceHeight,
  trim,
  targetWidth,
  targetHeight,
}: {
  sourceWidth: number;
  sourceHeight: number;
  trim: MediaTrim;
  targetWidth: number;
  targetHeight: number;
}): CroppedMediaLayout | null {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    return null;
  }

  const left = Math.min(finiteNonnegative(trim.left), sourceWidth - 1);
  const right = Math.min(finiteNonnegative(trim.right), sourceWidth - left - 1);
  const top = Math.min(finiteNonnegative(trim.top), sourceHeight - 1);
  const bottom = Math.min(finiteNonnegative(trim.bottom), sourceHeight - top - 1);
  const croppedWidth = sourceWidth - left - right;
  const croppedHeight = sourceHeight - top - bottom;
  const scale = Math.min(targetWidth / croppedWidth, targetHeight / croppedHeight);

  return {
    viewportWidth: croppedWidth * scale,
    viewportHeight: croppedHeight * scale,
    mediaWidth: sourceWidth * scale,
    mediaHeight: sourceHeight * scale,
    mediaLeft: -left * scale,
    mediaTop: -top * scale,
  };
}
