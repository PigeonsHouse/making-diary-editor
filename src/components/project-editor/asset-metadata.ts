import type { AssetRow } from "./types";

const positiveNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
};

export function getAssetDurationSeconds(asset: Pick<AssetRow, "metadata"> | undefined) {
  if (!asset) return null;
  const metadata = asset.metadata as {
    streams?: Array<{ duration?: unknown }>;
    format?: { duration?: unknown };
  };
  return (
    metadata.streams?.map((stream) => positiveNumber(stream.duration)).find((duration) => duration !== null) ??
    positiveNumber(metadata.format?.duration)
  );
}

export function getAssetDimensions(asset: Pick<AssetRow, "metadata"> | undefined) {
  if (!asset) return null;
  const metadata = asset.metadata as {
    streams?: Array<{ width?: unknown; height?: unknown }>;
  };
  for (const stream of metadata.streams ?? []) {
    const width = positiveNumber(stream.width);
    const height = positiveNumber(stream.height);
    if (width !== null && height !== null) return { width, height };
  }
  return null;
}
