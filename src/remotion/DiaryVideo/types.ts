import type { AssetVolumeMap } from "@/domain/audio";
import type { AssetTransparencyMap } from "@/domain/asset-transparency";
import type { Character, ProjectDocument } from "@/domain/types";

export type DiaryVideoProps = {
  project: ProjectDocument;
  characters: Character[];
  defaultEndHold?: number;
  dialoguePsdPreviewUrls?: Record<string, string>;
  assetVolumes?: AssetVolumeMap;
  assetTransparency?: AssetTransparencyMap;
};
