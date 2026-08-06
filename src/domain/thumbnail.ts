export type ThumbnailOutline = { width: number; color: string };
export type ThumbnailAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const thumbnailAnchorPercentages: Record<ThumbnailAnchor, [number, number]> = {
  "top-left": [0, 0],
  "top-center": [50, 0],
  "top-right": [100, 0],
  "center-left": [0, 50],
  center: [50, 50],
  "center-right": [100, 50],
  "bottom-left": [0, 100],
  "bottom-center": [50, 100],
  "bottom-right": [100, 100],
};

export function getThumbnailAnchorTransform(anchor: ThumbnailAnchor) {
  const [x, y] = thumbnailAnchorPercentages[anchor];
  return { translate: `${-x}% ${-y}%`, transformOrigin: `${x}% ${y}%` };
}

export function getCumulativeOutlineLayers(outlines: ThumbnailOutline[]) {
  let cumulativeWidth = 0;
  return outlines
    .map((outline, index) => {
      cumulativeWidth += Math.max(0, outline.width);
      return { ...outline, index, width: cumulativeWidth };
    })
    .reverse();
}

export function getRoundedOutlineTextShadow(width: number, color: string, directionCount = 32) {
  const radius = Math.max(0, width) / 2 / 19.2;
  if (radius === 0) return "none";
  return Array.from({ length: directionCount }, (_, index) => {
    const angle = (index / directionCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return `${x.toFixed(4)}cqw ${y.toFixed(4)}cqw 0 ${color}`;
  }).join(", ");
}
