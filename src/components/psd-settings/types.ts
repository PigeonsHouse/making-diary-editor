import type { Character } from "@/domain/types";

export type TreeNode = {
  path: string;
  name: string;
  type: "group" | "layer";
  children: TreeNode[];
};

export type PsdFilter = Character["psdFilters"][string];
