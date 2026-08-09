export type ChromaKeySettings = {
  enabled: boolean;
  color: string;
  similarity: number;
  edgeBlur: number;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const CHROMA_TRANSITION = 0.02;

export const RGB_TO_CHROMA_MATRIX = [
  -0.168736, -0.331264, 0.5, 0, 0.5, 0.5, -0.418688, -0.081312, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
].join(" ");

export function getChromaKeyAlphaMatrix(settings: ChromaKeySettings) {
  const similarity = clamp(settings.similarity, 0, 1);
  if (similarity === 1) {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].join(" ");
  }

  const transitionEnd = Math.min(1, similarity + CHROMA_TRANSITION);
  const thresholdSquared = similarity * similarity;
  const transitionEndSquared = transitionEnd * transitionEnd;
  const transitionWidthSquared = Math.max(Number.EPSILON, transitionEndSquared - thresholdSquared);
  const channelScale = 1 / transitionWidthSquared;
  const offset = -thresholdSquared / transitionWidthSquared;

  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, channelScale, channelScale, 0, 0, offset].join(" ");
}

export function getChromaKeyEdgeBlur(settings: ChromaKeySettings) {
  return clamp(settings.edgeBlur, 0, 100);
}
