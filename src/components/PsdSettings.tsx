"use client";

import {useEffect, useState} from "react";
import type {Character} from "@/domain/types";

type Group = {path: string; name: string; choices: Array<{path: string; name: string}>};

export function PsdSettings({character, update}: {
  character: Character;
  update: (recipe: (draft: Character) => void) => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [state, setState] = useState("");
  useEffect(() => {
    if (!character.psdAssetId) return setGroups([]);
    fetch(`/api/psd/${character.psdAssetId}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setGroups(body.groups);
    }).catch((error) => setState(error.message));
  }, [character.psdAssetId]);

  const upload = async (file?: File) => {
    if (!file) return;
    setState("アップロード中…");
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/assets", {method: "POST", body: form});
    const asset = await response.json();
    if (!response.ok) return setState(asset.error);
    update((draft) => { draft.psdAssetId = asset.id; draft.psdDefaults = {}; draft.avatar.previewUrl = null; });
    setState("PSDを解析しました");
  };

  const preview = async () => {
    if (!character.psdAssetId) return;
    setState("プレビュー生成中…");
    const response = await fetch(`/api/psd/${character.psdAssetId}`, {
      method: "POST", headers: {"content-type": "application/json"},
      body: JSON.stringify({selections: character.psdDefaults}),
    });
    const body = await response.json();
    if (!response.ok) return setState(body.error);
    update((draft) => { draft.avatar.previewUrl = body.url; });
    setState("プレビューを更新しました");
  };

  return (
    <section className="psd-settings">
      <div className="psd-heading"><div><strong>PSD立ち絵</strong><p>キャラクターの既定レイヤーを設定します。</p></div>
        <label className="upload-button">PSDを選択<input type="file" accept=".psd" onChange={(event) => void upload(event.target.files?.[0])} /></label>
      </div>
      {character.avatar.previewUrl ? <img className="psd-preview" src={character.avatar.previewUrl} alt="立ち絵プレビュー" /> : null}
      {groups.map((group) => (
        <label className="psd-group" key={group.path}>{group.name}
          <select value={character.psdDefaults[group.path] ?? ""} onChange={(event) => update((draft) => {
            if (event.target.value) draft.psdDefaults[group.path] = event.target.value;
            else delete draft.psdDefaults[group.path];
          })}>
            <option value="">PSDの表示状態を使用</option>
            {group.choices.map((choice) => <option value={choice.path} key={choice.path}>{choice.name}</option>)}
          </select>
        </label>
      ))}
      {character.psdAssetId ? <button className="secondary" onClick={preview}>プレビューを更新</button> : null}
      {state ? <span className="psd-state">{state}</span> : null}
    </section>
  );
}
