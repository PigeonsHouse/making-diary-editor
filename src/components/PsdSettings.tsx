"use client";

import { useEffect, useState } from "react";
import type { Character } from "@/domain/types";
import { PsdFilterEditor } from "./psd-settings/PsdFilterEditor";
import { TreePreview } from "./psd-settings/PsdTreePicker";
import type { PsdFilter, TreeNode } from "./psd-settings/types";
import {
  choiceNames,
  collectDirectLayers,
  countNodes,
  filterNames,
  flattenLayerPaths,
  layerNameFromPath,
  uniqueName,
} from "./psd-settings/utils";

export function PsdSettings({
  character,
  update,
}: {
  character: Character;
  update: (recipe: (draft: Character) => void) => void;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [state, setState] = useState("");
  const [structureOpen, setStructureOpen] = useState(false);

  useEffect(() => {
    if (!character.psdAssetId) return setTree([]);
    fetch(`/api/psd/${character.psdAssetId}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setTree(body.tree);
      })
      .catch((error) => setState(error.message));
  }, [character.psdAssetId]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (
      character.psdAssetId &&
      !window.confirm("PSDを変更すると、現在のレイヤー選択カテゴリと既定設定が削除されます。続行しますか？")
    )
      return;
    setState("アップロード中…");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/assets", { method: "POST", body: form });
    const asset = await response.json();
    if (!response.ok) return setState(asset.error);
    const treeResponse = await fetch(`/api/psd/${asset.id}`);
    const treeBody = await treeResponse.json();
    if (!treeResponse.ok) return setState(treeBody.error);
    const previewResponse = await fetch(`/api/psd/${asset.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filters: {}, selections: {} }),
    });
    const previewBody = await previewResponse.json();
    update((draft) => {
      draft.psdAssetId = asset.id;
      draft.psdDefaults = {};
      draft.psdFilterOrder = [];
      draft.psdFilters = {};
      draft.avatar.previewUrl = previewResponse.ok ? previewBody.url : null;
    });
    setTree(treeBody.tree);
    setSources({});
    setState(previewResponse.ok ? "PSDとプレビューを読み込みました" : previewBody.error);
  };

  const addFilter = () => {
    const requested = window.prompt("レイヤー選択カテゴリ名", "表情")?.trim();
    if (!requested) return;
    const name = uniqueName(requested, Object.keys(character.psdFilters));
    update((draft) => {
      draft.psdFilters[name] = { targets: [], choiceOrder: [], choices: {} };
      draft.psdFilterOrder.push(name);
    });
  };
  const changeFilter = (name: string, next: PsdFilter) =>
    update((draft) => {
      draft.psdFilters[name] = next;
      if (!next.choices[draft.psdDefaults[name]]) draft.psdDefaults[name] = choiceNames(next, tree)[0] ?? "";
    });
  const addSourceLayers = (name: string, filter: PsdFilter) => {
    const selectedFolders = sources[name] ?? [];
    if (selectedFolders.length === 0) return setState("選択肢追加元フォルダを選択してください");
    const layers = collectDirectLayers(tree, new Set(selectedFolders));
    const orderIndex = new Map(flattenLayerPaths(tree).map((path, index) => [path, index]));
    layers.sort((left, right) => (orderIndex.get(left.path) ?? 0) - (orderIndex.get(right.path) ?? 0));
    if (layers.length === 0) return setState("選択したフォルダ直下に単レイヤがありません");
    const choices = { ...filter.choices };
    const addedNames: string[] = [];
    const existingLayerNames = Object.values(choices)
      .map((choice) => layerNameFromPath(choice.show[0]))
      .filter(Boolean);
    const pendingNameCounts = layers.reduce<Record<string, number>>((counts, layer) => {
      counts[layer.name] = (counts[layer.name] ?? 0) + 1;
      return counts;
    }, {});
    for (const layer of layers) {
      if (Object.values(choices).some((choice) => choice.show.includes(layer.path))) continue;
      const duplicate = pendingNameCounts[layer.name] > 1 || existingLayerNames.includes(layer.name);
      const requestedName = duplicate ? `${layer.path.split("/").at(-2) ?? "root"}_${layer.name}` : layer.name;
      const choiceName = uniqueName(requestedName, Object.keys(choices));
      choices[choiceName] = { show: [layer.path] };
      addedNames.push(choiceName);
    }
    changeFilter(name, { ...filter, choices, choiceOrder: [...choiceNames(filter, tree), ...addedNames] });
    setSources((current) => ({ ...current, [name]: [] }));
    setState(`${layers.length}件のレイヤーを選択肢へ追加しました`);
  };
  const preview = async () => {
    if (!character.psdAssetId) return;
    setState("プレビュー生成中…");
    const response = await fetch(`/api/psd/${character.psdAssetId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filters: character.psdFilters, selections: character.psdDefaults }),
    });
    const body = await response.json();
    if (!response.ok) return setState(body.error);
    update((draft) => {
      draft.avatar.previewUrl = body.url;
    });
    setState("プレビューを更新しました");
  };

  return (
    <section className="psd-settings">
      <div className="psd-heading">
        <div>
          <strong>PSD立ち絵</strong>
          <p>セリフごとに切り替えるレイヤー選択カテゴリを設定します。</p>
        </div>
        <label className="upload-button">
          PSDを選択
          <input type="file" accept=".psd" onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
      </div>
      {character.psdAssetId ? (
        <div className="psd-preview-area">
          {character.avatar.previewUrl ? (
            <img className="psd-preview" src={character.avatar.previewUrl} alt="立ち絵プレビュー" />
          ) : (
            <div className="psd-preview-empty">プレビュー未生成</div>
          )}
          <button className="secondary" onClick={preview}>
            プレビューを更新
          </button>
        </div>
      ) : null}
      {tree.length ? (
        <details
          className="psd-structure-preview"
          open={structureOpen}
          onToggle={(event) => setStructureOpen(event.currentTarget.open)}
        >
          <summary>
            PSDツリー構造 <small>{countNodes(tree)}項目</small>
          </summary>
          {structureOpen ? (
            <div className="psd-tree psd-tree-readonly">
              {tree.map((node) => (
                <TreePreview key={node.path} node={node} />
              ))}
            </div>
          ) : null}
        </details>
      ) : null}
      {tree.length ? (
        <button className="secondary psd-add-category" onClick={addFilter}>
          ＋ レイヤー選択カテゴリ
        </button>
      ) : null}
      <div className="psd-filter-list">
        {filterNames(character).map((name) => {
          const filter = character.psdFilters[name];
          return (
            <PsdFilterEditor
              key={name}
              name={name}
              filter={filter}
              tree={tree}
              defaultChoice={character.psdDefaults[name] ?? ""}
              sourceFolders={sources[name] ?? []}
              setSourceFolders={(paths) => setSources((current) => ({ ...current, [name]: paths }))}
              onAddSourceLayers={() => addSourceLayers(name, filter)}
              onChange={(next) => changeFilter(name, next)}
              onDefaultChange={(choice) =>
                update((draft) => {
                  draft.psdDefaults[name] = choice;
                })
              }
              onDelete={() =>
                update((draft) => {
                  delete draft.psdFilters[name];
                  delete draft.psdDefaults[name];
                  draft.psdFilterOrder = draft.psdFilterOrder.filter((filterName) => filterName !== name);
                })
              }
            />
          );
        })}
      </div>
      {state ? <span className="psd-state">{state}</span> : null}
    </section>
  );
}
