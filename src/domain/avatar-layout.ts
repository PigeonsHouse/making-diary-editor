export type AvatarPosition = {
  id: string;
  side: "right" | "left";
  level: number;
  top: number;
  edgeOffsetXPx: number;
};

export const isAvatarFlipped = (index: number, override?: boolean) =>
  override ?? index % 2 === 1;

export function calculateAvatarPositions(
  characters: Array<{id: string; edgeOffsetXPx: number; peekYPx: number}>,
  overrides: Record<string, {edgeOffsetXPx?: number; peekYPx?: number}>,
  panelTop: number,
): AvatarPosition[] {
  const sideTops = {right: panelTop, left: panelTop};

  return characters.map((character, index) => {
    const side = index % 2 === 0 ? "right" : "left";
    const level = Math.floor(index / 2);
    const override = overrides[character.id];
    const peekYPx = override?.peekYPx ?? character.peekYPx;
    const edgeOffsetXPx = override?.edgeOffsetXPx ?? character.edgeOffsetXPx;
    const top = sideTops[side] - peekYPx;
    sideTops[side] = top;
    return {id: character.id, side, level, top, edgeOffsetXPx};
  });
}
