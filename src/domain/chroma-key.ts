export type ChromaKeySettings = {
  enabled: boolean;
  color: string;
  similarity: number;
  smoothness: number;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function getChromaKeyAlphaMatrix(settings: ChromaKeySettings) {
  const similarity = clamp(settings.similarity, 0, 1);
  const smoothness = clamp(settings.smoothness, 0.001, 1);
  const channelScale = 1 / (3 * smoothness);
  const offset = -similarity / smoothness;

  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, channelScale, channelScale, channelScale, 0, offset].join(" ");
}
