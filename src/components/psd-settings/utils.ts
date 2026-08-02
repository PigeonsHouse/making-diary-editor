import type { Character } from "@/domain/types";
import type { PsdFilter, TreeNode } from "./types";

export function collectDirectLayers(nodes: TreeNode[], selectedFolders: Set<string>): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "group" && selectedFolders.has(node.path)) {
      result.push(...node.children.filter((child) => child.type === "layer"));
    }
    result.push(...collectDirectLayers(node.children, selectedFolders));
  }
  return result;
}

export function flattenLayerPaths(nodes: TreeNode[]): string[] {
  return nodes.flatMap((node) => (node.type === "layer" ? [node.path] : flattenLayerPaths(node.children)));
}

export function choiceNames(filter: PsdFilter, tree: TreeNode[]) {
  const validNames = Object.keys(filter.choices);
  const explicit = filter.choiceOrder.filter((name) => validNames.includes(name));
  const missing = validNames.filter((name) => !explicit.includes(name));
  if (explicit.length > 0) return [...explicit, ...missing];

  const order = new Map(flattenLayerPaths(tree).map((path, index) => [path, index]));
  return missing.sort(
    (left, right) =>
      (order.get(filter.choices[left].show[0]) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(filter.choices[right].show[0]) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function uniqueName(requested: string, existing: string[]) {
  if (!existing.includes(requested)) return requested;
  let index = 2;
  while (existing.includes(`${requested}${index}`)) index++;
  return `${requested}${index}`;
}

export function filterNames(character: Character) {
  const valid = Object.keys(character.psdFilters);
  return [
    ...character.psdFilterOrder.filter((name) => valid.includes(name)),
    ...valid.filter((name) => !character.psdFilterOrder.includes(name)),
  ];
}

export function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0);
}

export function layerNameFromPath(path?: string) {
  return path?.split("/").at(-1) ?? "";
}
