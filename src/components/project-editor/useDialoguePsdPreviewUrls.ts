"use client";

import { useEffect, useMemo, useState } from "react";
import { createDialoguePsdPreviewSpecs } from "@/domain/psd-previews";
import type { Character, ProjectDocument } from "@/domain/types";

export function useDialoguePsdPreviewUrls(project: ProjectDocument, characters: Character[]) {
  const specs = useMemo(() => createDialoguePsdPreviewSpecs(project, characters), [project, characters]);
  const signature = JSON.stringify(specs.map((spec) => spec.key));
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setUrls({});
    if (specs.length === 0) return () => controller.abort();

    void Promise.all(
      specs.map(async (spec) => {
        const response = await fetch(`/api/psd/${spec.assetId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filters: spec.filters, selections: spec.selections }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "立ち絵プレビューを生成できませんでした");
        return { dialogueIds: spec.dialogueIds, url: result.url as string };
      }),
    )
      .then((results) => {
        if (controller.signal.aborted) return;
        setUrls(
          Object.fromEntries(
            results.flatMap(({ dialogueIds, url }) => dialogueIds.map((dialogueId) => [dialogueId, url])),
          ),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setUrls({});
      });

    return () => controller.abort();
  }, [signature]);

  return urls;
}
