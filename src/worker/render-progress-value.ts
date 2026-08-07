import type { RenderMediaProgress } from "@remotion/renderer";

export function calculateDetailedRenderProgress(
  progress: Pick<RenderMediaProgress, "renderedFrames" | "encodedFrames" | "progress">,
  totalFrames: number,
) {
  if (!Number.isFinite(totalFrames) || totalFrames <= 0) return Math.max(0, Math.min(1, progress.progress));
  // Remotion weights rendering at 70% and encoding/muxing at 30%, but rounds
  // the public `progress` field to whole percentage points. Keep its weighting
  // while retaining the precision available in the frame counters.
  const weightedFrames = progress.renderedFrames * 0.7 + progress.encodedFrames * 0.3;
  return Math.max(0, Math.min(1, weightedFrames / totalFrames));
}
