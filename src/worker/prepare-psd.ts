import path from "node:path";
import { createDialoguePsdPreviewSpecs } from "@/domain/psd-previews";
import type { Character, ProjectDocument } from "@/domain/types";
import { db } from "@/server/db";
import { assets } from "@/server/db/schema";
import { renderPsdPreview } from "@/server/psd";
import { mapWithConcurrency } from "./async-map";
import { getPsdConcurrency } from "./render-config";

export async function prepareDialoguePsdPreviews(project: ProjectDocument, characters: Character[], dataDir: string) {
  const specs = [
    ...createDialoguePsdPreviewSpecs(project, characters),
    ...characters
      .filter((character) => character.psdAssetId)
      .map((character) => ({
        key: `character:${character.id}`,
        assetId: character.psdAssetId!,
        filters: character.psdFilters,
        selections: character.psdDefaults,
        dialogueIds: [`character:${character.id}`],
      })),
  ];
  const urls: Record<string, string> = {};
  if (specs.length === 0) return urls;

  const assetRows = await db.select().from(assets);
  const assetsById = new Map(assetRows.map((asset) => [asset.id, asset]));
  const specsByAsset = new Map<string, typeof specs>();
  for (const spec of specs) {
    const group = specsByAsset.get(spec.assetId) ?? [];
    group.push(spec);
    specsByAsset.set(spec.assetId, group);
  }

  await mapWithConcurrency([...specsByAsset.entries()], getPsdConcurrency(), async ([assetId, groupedSpecs]) => {
    const asset = assetsById.get(assetId);
    if (!asset) return;
    for (const spec of groupedSpecs) {
      const hash = await renderPsdPreview(
        asset.originalPath,
        spec.filters,
        spec.selections,
        path.join(dataDir, "psd-previews"),
        asset.id,
      );
      for (const dialogueId of spec.dialogueIds) urls[dialogueId] = `/api/files/psd/${hash}.png`;
    }
  });

  return urls;
}
