import { describe, expect, it } from "vitest";
import { formatRenderEta, formatRenderProgress, getRenderStatusText, type RenderJobSummary } from "./useRenderJobs";

describe("formatRenderProgress", () => {
  it("always shows one decimal place", () => {
    expect(formatRenderProgress(0)).toBe("0.0%");
    expect(formatRenderProgress(12.3)).toBe("12.3%");
    expect(formatRenderProgress(100)).toBe("100.0%");
  });
});

describe("formatRenderEta", () => {
  it("formats Remotion ETA for the GUI", () => {
    expect(formatRenderEta(null)).toBeNull();
    expect(formatRenderEta(0)).toBeNull();
    expect(formatRenderEta(44_000)).toBe("残り約44秒");
    expect(formatRenderEta(1_784_000)).toBe("残り約29分44秒");
    expect(formatRenderEta(3_724_000)).toBe("残り約1時間2分");
  });
});

describe("getRenderStatusText", () => {
  it("excludes ETA while render prerequisites are still running", () => {
    const job: RenderJobSummary = {
      id: "render-1",
      projectId: "project-1",
      status: "preparing",
      progress: 0,
      etaMs: 3_600_000,
      error: null,
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    };

    expect(getRenderStatusText(job)).toBe("レンダリング準備中…（ETA計算前）");
  });
});
