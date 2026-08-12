"use client";

import { useMemo, useState } from "react";
import { getSupportNarrationSpecs, isSupportCacheCurrent, reconcileSupportNarrations } from "@/domain/support-credits";
import type { Character, ProjectDocument, SupportCreditsCache, SupportNarration } from "@/domain/types";
import { AudioOverrideEditor } from "../AudioSettings";
import type { AssetRow, UpdateProject } from "../types";
import { SupportVideoList } from "./SupportVideoList";
import { SupportVoiceRow } from "./SupportVoiceRow";
import { useSupportVoiceGeneration } from "./useSupportVoiceGeneration";
import { formatFetchedAt } from "./utils";

type Props = { project: ProjectDocument; characters: Character[]; assets: AssetRow[]; update: UpdateProject };

export function SupportCreditsEditor({ project, characters, assets, update }: Props) {
  const credits = project.supportCredits;
  const [fetchState, setFetchState] = useState<"idle" | "loading">("idle");
  const [fetchError, setFetchError] = useState("");
  const availableCharacters = project.characterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is Character => Boolean(character));
  const narrator = characters.find((character) => character.id === credits.narratorCharacterId) ?? null;
  const cacheCurrent = isSupportCacheCurrent(credits);
  const specs = useMemo(() => getSupportNarrationSpecs(credits.cache), [credits.cache]);
  const specByKey = useMemo(() => new Map(specs.map((spec) => [spec.key, spec])), [specs]);
  const readyCount = credits.narrations.filter((item) => item.audio.status === "ready").length;
  const errorCount = credits.narrations.filter((item) => item.audio.status === "error").length;
  const voiceRequestState = useSupportVoiceGeneration({
    cacheCurrent,
    narrations: credits.narrations,
    narrator,
    update,
  });

  const mutateNarration = (key: string, recipe: (dialogue: SupportNarration) => void) =>
    update((draft) => {
      const narration = draft.supportCredits.narrations.find((item) => item.key === key);
      if (narration) recipe(narration);
    });

  const refresh = async () => {
    setFetchState("loading");
    setFetchError("");
    try {
      const response = await fetch("/api/support-credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videos: credits.videos }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "支援情報を取得できませんでした");
      const cache = result as SupportCreditsCache;
      update((draft) => {
        draft.supportCredits.cache = cache;
        draft.supportCredits.narrations = reconcileSupportNarrations(
          cache,
          draft.supportCredits.narratorCharacterId,
          draft.supportCredits.narrations,
        );
      });
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "支援情報を取得できませんでした");
    } finally {
      setFetchState("idle");
    }
  };

  return (
    <div id="panel-support" role="tabpanel" aria-labelledby="tab-support" className="editor-tab-panel">
      <section className="panel support-settings">
        <div className="support-panel-heading">
          <div>
            <strong>広告・ギフト紹介</strong>
            <small>完成動画の末尾へ追加されます</small>
          </div>
          <button
            className="primary"
            disabled={fetchState === "loading" || credits.videos.length === 0}
            onClick={() => void refresh()}
          >
            {fetchState === "loading" ? "取得中…" : "支援情報を更新"}
          </button>
        </div>
        <div className="support-settings-grid">
          <label>
            <span>読み上げ担当</span>
            <select
              value={credits.narratorCharacterId ?? ""}
              onChange={(event) =>
                update((draft) => {
                  const id = event.target.value || null;
                  draft.supportCredits.narratorCharacterId = id;
                  draft.supportCredits.narrations = reconcileSupportNarrations(
                    draft.supportCredits.cache,
                    id,
                    draft.supportCredits.narrations,
                  );
                })
              }
            >
              <option value="">選択してください</option>
              {availableCharacters.map((character) => (
                <option value={character.id} key={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
          <AudioOverrideEditor
            label="BGM"
            value={credits.bgm}
            projectDefault={project.audio.bgm}
            assets={assets}
            noneLabel="BGMなし"
            onChange={(bgm) => update((draft) => void (draft.supportCredits.bgm = bgm))}
          />
          <AudioOverrideEditor
            label="冒頭SE"
            value={credits.sceneIntroSe}
            projectDefault={project.audio.sceneIntroSe}
            assets={assets}
            noneLabel="冒頭SEなし"
            onChange={(sceneIntroSe) => update((draft) => void (draft.supportCredits.sceneIntroSe = sceneIntroSe))}
          />
        </div>
        <SupportVideoList project={project} update={update} />
        <div className={`support-cache-state ${!cacheCurrent && credits.cache ? "stale" : ""}`}>
          {credits.cache ? `キャッシュ作成：${formatFetchedAt(credits.cache.fetchedAt)}` : "まだ取得していません"}
          {!cacheCurrent && credits.cache ? "（設定変更後、未更新）" : ""}
        </div>
        {fetchError ? (
          <div className="support-error" role="alert">
            {fetchError}（以前のキャッシュは保持されています）
          </div>
        ) : null}
      </section>

      {credits.cache && cacheCurrent ? (
        <section className="panel support-cache-summary">
          <div className="support-panel-heading">
            <strong>取得結果</strong>
          </div>
          {credits.cache.videos.map((video) => (
            <div className="support-cache-video" key={video.videoId}>
              <img src={video.thumbnailUrl} alt="" />
              <div>
                <strong>{video.title}</strong>
                <small>{video.videoId}</small>
              </div>
              <span>ギフト {video.gifts.length}件</span>
              <span>広告主 {video.advertisers.length}人</span>
            </div>
          ))}
        </section>
      ) : null}

      {credits.narrations.length > 0 && narrator && cacheCurrent ? (
        <section className="panel support-narrations">
          <div className="support-panel-heading">
            <div>
              <strong>調声</strong>
              <small>
                {readyCount}/{credits.narrations.length}件生成済み{errorCount ? `・${errorCount}件失敗` : ""}
              </small>
            </div>
          </div>
          {credits.narrations.map((narration, index) => (
            <SupportVoiceRow
              key={narration.key}
              narration={narration}
              character={narrator}
              label={specByKey.get(narration.key)?.videoId ?? (narration.key.startsWith("intro") ? "冒頭" : "締め")}
              index={index}
              generationState={voiceRequestState?.key === narration.key ? voiceRequestState.status : null}
              updateDialogue={(recipe) => mutateNarration(narration.key, recipe)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
