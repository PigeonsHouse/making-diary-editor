"use client";

import {useEffect, useState} from "react";
import type {Character} from "@/domain/types";

type TreeNode = {path: string; name: string; type: "group" | "layer"; children: TreeNode[]};
type Filter = Character["psdFilters"][string];

export function PsdSettings({character, update}: {
  character: Character;
  update: (recipe: (draft: Character) => void) => void;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [sources, setSources] = useState<Record<string, string[]>>({});
  const [state, setState] = useState("");
  const [structureOpen, setStructureOpen] = useState(false);

  useEffect(() => {
    if (!character.psdAssetId) return setTree([]);
    fetch(`/api/psd/${character.psdAssetId}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setTree(body.tree);
    }).catch((error) => setState(error.message));
  }, [character.psdAssetId]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (character.psdAssetId && !window.confirm("PSDを変更すると、現在のレイヤー選択カテゴリと既定設定が削除されます。続行しますか？")) return;
    setState("アップロード中…");
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/assets", {method: "POST", body: form});
    const asset = await response.json();
    if (!response.ok) return setState(asset.error);
    const treeResponse = await fetch(`/api/psd/${asset.id}`);
    const treeBody = await treeResponse.json();
    if (!treeResponse.ok) return setState(treeBody.error);
    const previewResponse = await fetch(`/api/psd/${asset.id}`, {
      method: "POST", headers: {"content-type": "application/json"},
      body: JSON.stringify({filters: {}, selections: {}}),
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
      draft.psdFilters[name] = {targets: [], choiceOrder: [], choices: {}};
      draft.psdFilterOrder.push(name);
    });
  };

  const changeFilter = (name: string, next: Filter) => update((draft) => {
    draft.psdFilters[name] = next;
    if (!next.choices[draft.psdDefaults[name]]) {
      draft.psdDefaults[name] = choiceNames(next, tree)[0] ?? "";
    }
  });

  const addSourceLayers = (name: string, filter: Filter) => {
    const selectedFolders = sources[name] ?? [];
    if (selectedFolders.length === 0) return setState("選択肢追加元フォルダを選択してください");
    const selectedSet = new Set(selectedFolders);
    const layerOrder = flattenLayerPaths(tree);
    const orderIndex = new Map(layerOrder.map((path, index) => [path, index]));
    const layers = collectDirectLayers(tree, selectedSet).sort(
      (left, right) => (orderIndex.get(left.path) ?? 0) - (orderIndex.get(right.path) ?? 0),
    );
    if (layers.length === 0) return setState("選択したフォルダ直下に単レイヤがありません");
    const choices = {...filter.choices};
    const addedNames: string[] = [];
    const existingLayerNames = Object.values(choices)
      .map((choice) => layerNameFromPath(choice.show[0]))
      .filter(Boolean);
    const pendingNameCounts = layers.reduce<Record<string, number>>((counts, layer) => {
      counts[layer.name] = (counts[layer.name] ?? 0) + 1;
      return counts;
    }, {});
    for (const layer of layers) {
      const existing = Object.values(choices).some((choice) => choice.show.includes(layer.path));
      if (!existing) {
        const hasSameLayerName = pendingNameCounts[layer.name] > 1 || existingLayerNames.includes(layer.name);
        const parentName = layer.path.split("/").at(-2) ?? "root";
        const requestedName = hasSameLayerName ? `${parentName}_${layer.name}` : layer.name;
        const choiceName = uniqueName(requestedName, Object.keys(choices));
        choices[choiceName] = {show: [layer.path]};
        addedNames.push(choiceName);
      }
    }
    changeFilter(name, {...filter, choices, choiceOrder: [...choiceNames(filter, tree), ...addedNames]});
    setSources((current) => ({...current, [name]: []}));
    setState(`${layers.length}件のレイヤーを選択肢へ追加しました`);
  };

  const preview = async () => {
    if (!character.psdAssetId) return;
    setState("プレビュー生成中…");
    const response = await fetch(`/api/psd/${character.psdAssetId}`, {
      method: "POST", headers: {"content-type": "application/json"},
      body: JSON.stringify({filters: character.psdFilters, selections: character.psdDefaults}),
    });
    const body = await response.json();
    if (!response.ok) return setState(body.error);
    update((draft) => { draft.avatar.previewUrl = body.url; });
    setState("プレビューを更新しました");
  };

  return (
    <section className="psd-settings">
      <div className="psd-heading">
        <div><strong>PSD立ち絵</strong><p>セリフごとに切り替えるレイヤー選択カテゴリを設定します。</p></div>
        <label className="upload-button">PSDを選択<input type="file" accept=".psd" onChange={(event) => void upload(event.target.files?.[0])} /></label>
      </div>
      {character.psdAssetId ? <div className="psd-preview-area">
        {character.avatar.previewUrl
          ? <img className="psd-preview" src={character.avatar.previewUrl} alt="立ち絵プレビュー" />
          : <div className="psd-preview-empty">プレビュー未生成</div>}
        <button className="secondary" onClick={preview}>プレビューを更新</button>
      </div> : null}
      {tree.length ? <details className="psd-structure-preview" open={structureOpen}
        onToggle={(event) => setStructureOpen(event.currentTarget.open)}>
        <summary>PSDツリー構造 <small>{countNodes(tree)}項目</small></summary>
        {structureOpen ? <div className="psd-tree psd-tree-readonly">{tree.map((node) =>
          <TreePreview key={node.path} node={node} />)}</div> : null}
      </details> : null}
      {tree.length ? <button className="secondary psd-add-category" onClick={addFilter}>＋ レイヤー選択カテゴリ</button> : null}

      <div className="psd-filter-list">
        {filterNames(character).map((name) => (
          (() => { const filter = character.psdFilters[name]; return (
          <FilterEditor key={name} name={name} filter={filter} tree={tree}
            defaultChoice={character.psdDefaults[name] ?? ""}
            sourceFolders={sources[name] ?? []}
            setSourceFolders={(paths) => setSources((current) => ({...current, [name]: paths}))}
            onAddSourceLayers={() => addSourceLayers(name, filter)}
            onChange={(next) => changeFilter(name, next)}
            onDefaultChange={(choice) => update((draft) => { draft.psdDefaults[name] = choice; })}
            onDelete={() => update((draft) => {
              delete draft.psdFilters[name]; delete draft.psdDefaults[name];
              draft.psdFilterOrder = draft.psdFilterOrder.filter((filterName) => filterName !== name);
            })}
          />
          ); })()
        ))}
      </div>

      {state ? <span className="psd-state">{state}</span> : null}
    </section>
  );
}

function FilterEditor({name, filter, tree, defaultChoice, sourceFolders, setSourceFolders,
  onAddSourceLayers, onChange, onDefaultChange, onDelete}: {
  name: string; filter: Filter; tree: TreeNode[]; defaultChoice: string; sourceFolders: string[];
  setSourceFolders: (paths: string[]) => void; onAddSourceLayers: () => void;
  onChange: (filter: Filter) => void; onDefaultChange: (choice: string) => void; onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const addEmptyChoice = () => {
    const requested = window.prompt("選択肢名", "新規")?.trim();
    if (!requested) return;
    const choiceName = uniqueName(requested, Object.keys(filter.choices));
    onChange({
      ...filter,
      choiceOrder: [...choiceNames(filter, tree), choiceName],
      choices: {...filter.choices, [choiceName]: {show: []}},
    });
  };
  return (
    <details className="psd-filter-editor" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <strong>{name}</strong>
        <label className="psd-summary-default" onClick={(event) => event.stopPropagation()}>既定
          <select value={defaultChoice} onChange={(event) => onDefaultChange(event.target.value)}>
            <option value="">未指定</option>
            {choiceNames(filter, tree).map((choice) => <option key={choice}>{choice}</option>)}
          </select>
        </label>
        <small>{Object.keys(filter.choices).length}選択肢</small>
        <button className="psd-category-delete" title="カテゴリを削除" onClick={(event) => {
          event.preventDefault(); event.stopPropagation(); onDelete();
        }}>×</button>
      </summary>
      {isOpen ? <div className="psd-filter-body">
        <div className="psd-filter-toolbar">
          <button className="secondary" onClick={addEmptyChoice}>＋ 空の選択肢</button>
        </div>
        <PathPicker label="表示制御の対象" tree={tree} selected={filter.targets}
          selectable="all" onChange={(targets) => onChange({...filter, targets})} />
        <PathPicker label="選択肢追加元フォルダ" tree={tree} selected={sourceFolders}
          selectable="group" onChange={setSourceFolders}
          action={<button className="secondary psd-add-layers" onClick={onAddSourceLayers}>直下の単レイヤを選択肢へ一括追加</button>} />
        {choiceNames(filter, tree).map((choiceName) => (
          <ChoiceEditor key={choiceName} name={choiceName} choice={filter.choices[choiceName]} tree={tree}
            onChange={(next) => onChange({...filter, choices: {...filter.choices, [choiceName]: next}})}
            onDelete={() => {
              const choices = {...filter.choices}; delete choices[choiceName];
              onChange({...filter, choices, choiceOrder: choiceNames(filter, tree).filter((name) => name !== choiceName)});
            }}
            onRename={(requestedName) => {
              const otherNames = Object.keys(filter.choices).filter((name) => name !== choiceName);
              const renamedName = uniqueName(requestedName, otherNames);
              const choices = {...filter.choices};
              delete choices[choiceName];
              choices[renamedName] = filter.choices[choiceName];
              onChange({
                ...filter,
                choices,
                choiceOrder: choiceNames(filter, tree).map((name) => name === choiceName ? renamedName : name),
              });
              if (defaultChoice === choiceName) onDefaultChange(renamedName);
            }} />
        ))}
      </div> : null}
    </details>
  );
}

function ChoiceEditor({name, choice, tree, onChange, onDelete, onRename}: {
  name: string; choice: {show: string[]; hide?: string[]}; tree: TreeNode[];
  onChange: (choice: {show: string[]; hide?: string[]}) => void; onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="psd-choice-card" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        <strong>{name}</strong>
        <small>{choice.show.length} ON / {(choice.hide ?? []).length} OFF</small>
        <button className="psd-choice-rename" title="選択肢名を変更" onClick={(event) => {
          event.preventDefault(); event.stopPropagation();
          const nextName = window.prompt("選択肢名", name)?.trim();
          if (nextName && nextName !== name) onRename(nextName);
        }}>✎</button>
        <button className="psd-choice-delete" title="選択肢を削除" onClick={(event) => {
          event.preventDefault(); event.stopPropagation(); onDelete();
        }}>×</button>
      </summary>
      {isOpen ? <div className="psd-choice-body">
        <PathPicker label="この選択肢でONにするレイヤー" tree={tree} selected={choice.show}
          selectable="all" onChange={(show) => onChange({...choice, show})} />
        <PathPicker label="この選択肢でOFFにするレイヤー" tree={tree} selected={choice.hide ?? []}
          selectable="all" onChange={(hide) => onChange({...choice, hide})} />
      </div> : null}
    </details>
  );
}

function PathPicker({label, tree, selected, selectable, onChange, action}: {
  label: string; tree: TreeNode[]; selected: string[]; selectable: "all" | "group";
  onChange: (paths: string[]) => void; action?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="psd-source-picker" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>{label}<small>{selected.length}件選択</small></summary>
      {isOpen ? <><div className="psd-tree">{tree.map((node) => <TreePicker key={node.path} node={node}
        selected={selected} selectable={selectable} onChange={onChange} />)}</div>
      {action}</> : null}
    </details>
  );
}

function TreePicker({node, selected, selectable, onChange}: {
  node: TreeNode; selected: string[]; selectable: "all" | "group"; onChange: (paths: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const enabled = selectable === "all" || node.type === "group";
  return <div className="psd-tree-node">
    <label className={`psd-tree-row ${node.type} ${enabled ? "" : "disabled"}`}>
      {node.children.length ? <button type="button" className="psd-tree-toggle" onClick={() => setIsOpen((open) => !open)}>
        {isOpen ? "▾" : "▸"}
      </button> : <span className="psd-tree-toggle-placeholder" />}
      <input type="checkbox" disabled={!enabled} checked={selected.includes(node.path)} onChange={(event) => onChange(
        event.target.checked ? [...selected, node.path] : selected.filter((path) => path !== node.path),
      )} />{node.name}
    </label>
    {node.children.length && isOpen ? <div className="psd-tree-children">{node.children.map((child) => <TreePicker
      key={child.path} node={child} selected={selected} selectable={selectable} onChange={onChange} />)}</div> : null}
  </div>;
}

function TreePreview({node}: {node: TreeNode}) {
  const [isOpen, setIsOpen] = useState(false);
  return <div className="psd-tree-node">
    <button type="button" className={`psd-tree-preview-row ${node.type}`} onClick={() => setIsOpen((open) => !open)}>
      <span>{node.children.length ? (isOpen ? "▾" : "▸") : ""}</span>{node.name}
    </button>
    {isOpen && node.children.length ? <div className="psd-tree-children">{node.children.map((child) =>
      <TreePreview key={child.path} node={child} />)}</div> : null}
  </div>;
}

function collectDirectLayers(nodes: TreeNode[], selectedFolders: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "group" && selectedFolders.has(node.path)) {
      result.push(...node.children.filter((child) => child.type === "layer"));
    }
    result.push(...collectDirectLayers(node.children, selectedFolders));
  }
  return result;
}

function flattenLayerPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((node) => node.type === "layer"
    ? [node.path]
    : flattenLayerPaths(node.children));
}

function choiceNames(filter: Filter, tree: TreeNode[]) {
  const validNames = Object.keys(filter.choices);
  const explicit = filter.choiceOrder.filter((name) => validNames.includes(name));
  const missing = validNames.filter((name) => !explicit.includes(name));
  if (explicit.length > 0) return [...explicit, ...missing];

  // choiceOrder導入前のデータだけ、初回表示時にPSDツリー順を復元する。
  const order = new Map(flattenLayerPaths(tree).map((path, index) => [path, index]));
  return missing.sort((left, right) =>
    (order.get(filter.choices[left].show[0]) ?? Number.MAX_SAFE_INTEGER) -
    (order.get(filter.choices[right].show[0]) ?? Number.MAX_SAFE_INTEGER));
}

function uniqueName(requested: string, existing: string[]) {
  if (!existing.includes(requested)) return requested;
  let index = 2; while (existing.includes(`${requested}${index}`)) index++;
  return `${requested}${index}`;
}

function filterNames(character: Character) {
  const valid = Object.keys(character.psdFilters);
  return [...character.psdFilterOrder.filter((name) => valid.includes(name)),
    ...valid.filter((name) => !character.psdFilterOrder.includes(name))];
}

function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0);
}

function layerNameFromPath(path?: string) {
  return path?.split("/").at(-1) ?? "";
}
