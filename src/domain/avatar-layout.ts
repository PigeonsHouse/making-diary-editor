export type AvatarPosition = {
  id: string;
  side: "right" | "left";
  level: number;
  top: number;
  edgeOffsetXPx: number;
  scale: number;
};

export const isAvatarFlipped = (index: number, override?: boolean) => override ?? index % 2 === 1;

export function calculateAvatarPositions(
  characters: Array<{ id: string; edgeOffsetXPx: number; peekYPx: number; scale: number }>,
  overrides: Record<string, { edgeOffsetXPx?: number; peekYPx?: number }>,
  panelTop: number,
  avatarHeight: number,
): AvatarPosition[] {
  const sideCenters = { right: panelTop, left: panelTop };

  return characters.map((character, index) => {
    const side = index % 2 === 0 ? "right" : "left";
    const level = Math.floor(index / 2);
    const override = overrides[character.id];
    const centerOffsetYPx = override?.peekYPx ?? character.peekYPx;
    const edgeOffsetXPx = override?.edgeOffsetXPx ?? character.edgeOffsetXPx;
    const centerY = sideCenters[side] - centerOffsetYPx * character.scale;
    const top = centerY - (avatarHeight * character.scale) / 2;
    sideCenters[side] = centerY;
    return {
      id: character.id,
      side,
      level,
      top,
      edgeOffsetXPx: edgeOffsetXPx * character.scale,
      scale: character.scale,
    };
  });
}
