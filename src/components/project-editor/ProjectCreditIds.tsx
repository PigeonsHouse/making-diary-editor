"use client";

import { useState } from "react";
import type { Character, ProjectDocument } from "@/domain/types";
import { getProjectCreditIds } from "@/domain/project-credit-ids";
import type { AssetRow } from "./types";

const nicovideoWorksUrl = (id: string) => `https://commons.nicovideo.jp/works/${encodeURIComponent(id)}`;

export function ProjectCreditIds({
  project,
  characters,
  assets,
}: {
  project: ProjectDocument;
  characters: Character[];
  assets: AssetRow[];
}) {
  const ids = getProjectCreditIds(project, characters, assets);
  const [copyState, setCopyState] = useState("");
  const copyIds = async () => {
    try {
      await navigator.clipboard.writeText(ids.join(" "));
      setCopyState("コピーしました");
    } catch {
      setCopyState("コピーできませんでした");
    }
  };

  return (
    <section className="panel project-credit-ids">
      <div className="asset-library-heading">
        <span>使用ID一覧</span>
        <div className="project-credit-id-actions">
          {copyState ? <small role="status">{copyState}</small> : null}
          <button className="secondary" type="button" disabled={ids.length === 0} onClick={() => void copyIds()}>
            IDをコピー
          </button>
        </div>
      </div>
      {ids.length > 0 ? (
        <div className="project-credit-id-list">
          {ids.map((id) => (
            <a key={id} href={nicovideoWorksUrl(id)} target="_blank" rel="noreferrer">
              <code>{id}</code>
            </a>
          ))}
        </div>
      ) : (
        <p className="project-credit-id-empty">対象のIDはありません。</p>
      )}
    </section>
  );
}
