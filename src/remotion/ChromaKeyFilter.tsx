import type { ChromaKeySettings } from "@/domain/chroma-key";
import { RGB_TO_CHROMA_MATRIX, getChromaKeyAlphaMatrix, getChromaKeyEdgeBlur } from "@/domain/chroma-key";

export function ChromaKeyFilter({ id, settings }: { id: string; settings: ChromaKeySettings }) {
  if (!settings.enabled) return null;

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feFlood floodColor={settings.color} result="key-color" />
        <feComposite in="key-color" in2="SourceGraphic" operator="in" result="bounded-key-color" />
        <feColorMatrix in="SourceGraphic" type="matrix" values={RGB_TO_CHROMA_MATRIX} result="source-chroma" />
        <feColorMatrix in="bounded-key-color" type="matrix" values={RGB_TO_CHROMA_MATRIX} result="key-chroma" />
        <feBlend in="source-chroma" in2="key-chroma" mode="difference" result="chroma-distance" />
        <feComposite
          in="chroma-distance"
          in2="chroma-distance"
          operator="arithmetic"
          k1={1}
          result="squared-chroma-distance"
        />
        <feColorMatrix
          in="squared-chroma-distance"
          type="matrix"
          values={getChromaKeyAlphaMatrix(settings)}
          result="key-matte"
        />
        <feComposite in="SourceGraphic" in2="key-matte" operator="in" result="keyed-source" />
        <feGaussianBlur in="key-matte" stdDeviation={getChromaKeyEdgeBlur(settings)} result="feathered-key-matte" />
        <feComposite in="keyed-source" in2="feathered-key-matte" operator="in" />
      </filter>
    </svg>
  );
}
