export type AssetTransparencyMap = Readonly<Record<string, boolean>>;

type AssetMetadata = {
  hasAlpha?: unknown;
};

export function assetMetadataHasAlpha(metadata: unknown) {
  return typeof metadata === "object" && metadata !== null && (metadata as AssetMetadata).hasAlpha === true;
}

export function createAssetTransparencyMap(assets: ReadonlyArray<{ id: string; metadata: unknown }>) {
  return Object.fromEntries(
    assets.filter((asset) => assetMetadataHasAlpha(asset.metadata)).map((asset) => [asset.id, true]),
  ) as AssetTransparencyMap;
}
