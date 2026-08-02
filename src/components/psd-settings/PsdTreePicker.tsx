"use client";

import { useState, type ReactNode } from "react";
import type { TreeNode } from "./types";

export function PathPicker({
  label,
  tree,
  selected,
  selectable,
  onChange,
  action,
}: {
  label: string;
  tree: TreeNode[];
  selected: string[];
  selectable: "all" | "group";
  onChange: (paths: string[]) => void;
  action?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="psd-source-picker" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary>
        {label}
        <small>{selected.length}件選択</small>
      </summary>
      {isOpen ? (
        <>
          <div className="psd-tree">
            {tree.map((node) => (
              <TreePicker key={node.path} node={node} selected={selected} selectable={selectable} onChange={onChange} />
            ))}
          </div>
          {action}
        </>
      ) : null}
    </details>
  );
}

function TreePicker({
  node,
  selected,
  selectable,
  onChange,
}: {
  node: TreeNode;
  selected: string[];
  selectable: "all" | "group";
  onChange: (paths: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const enabled = selectable === "all" || node.type === "group";
  return (
    <div className="psd-tree-node">
      <label className={`psd-tree-row ${node.type} ${enabled ? "" : "disabled"}`}>
        {node.children.length ? (
          <button type="button" className="psd-tree-toggle" onClick={() => setIsOpen((open) => !open)}>
            {isOpen ? "▾" : "▸"}
          </button>
        ) : (
          <span className="psd-tree-toggle-placeholder" />
        )}
        <input
          type="checkbox"
          disabled={!enabled}
          checked={selected.includes(node.path)}
          onChange={(event) =>
            onChange(event.target.checked ? [...selected, node.path] : selected.filter((path) => path !== node.path))
          }
        />
        {node.name}
      </label>
      {node.children.length && isOpen ? (
        <div className="psd-tree-children">
          {node.children.map((child) => (
            <TreePicker key={child.path} node={child} selected={selected} selectable={selectable} onChange={onChange} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TreePreview({ node }: { node: TreeNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="psd-tree-node">
      <button type="button" className={`psd-tree-preview-row ${node.type}`} onClick={() => setIsOpen((open) => !open)}>
        <span>{node.children.length ? (isOpen ? "▾" : "▸") : ""}</span>
        {node.name}
      </button>
      {isOpen && node.children.length ? (
        <div className="psd-tree-children">
          {node.children.map((child) => (
            <TreePreview key={child.path} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
