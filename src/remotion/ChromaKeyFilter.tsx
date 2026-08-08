import type { ChromaKeySettings } from "@/domain/chroma-key";
import { getChromaKeyAlphaMatrix } from "@/domain/chroma-key";

export function ChromaKeyFilter({ id, settings }: { id: string; settings: ChromaKeySettings }) {
  if (!settings.enabled) return null;

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feFlood floodColor={settings.color} result="key-color" />
        <feComposite in="key-color" in2="SourceGraphic" operator="in" result="bounded-key-color" />
        <feBlend in="SourceGraphic" in2="bounded-key-color" mode="difference" result="color-distance" />
        <feColorMatrix
          in="color-distance"
          type="matrix"
          values={getChromaKeyAlphaMatrix(settings)}
          result="key-matte"
        />
        <feComposite in="SourceGraphic" in2="key-matte" operator="in" />
      </filter>
    </svg>
  );
}
