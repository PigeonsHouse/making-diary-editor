import { describe, expect, it } from "vitest";
import { getAssetNormalizationArgs, getNormalizedAssetExtension, probeHasAlpha } from "./asset-normalization";

describe("probeHasAlpha", () => {
  it.each(["rgba", "yuva444p10le", "gbrap12le", "ya16le", "argb", "pal8"])(
    "recognizes the alpha pixel format %s",
    (pix_fmt) => {
      expect(probeHasAlpha({ streams: [{ pix_fmt }] })).toBe(true);
    },
  );

  it("recognizes WebM alpha metadata even when ffprobe reports a YUV pixel format", () => {
    expect(probeHasAlpha({ streams: [{ pix_fmt: "yuv420p", tags: { alpha_mode: "1" } }] })).toBe(true);
  });

  it("does not classify ordinary RGB or YUV streams as transparent", () => {
    expect(probeHasAlpha({ streams: [{ pix_fmt: "rgb24" }, { pix_fmt: "yuv420p" }] })).toBe(false);
  });
});

describe("asset normalization", () => {
  it("uses PNG for transparent images", () => {
    const output = "normalized/asset.png";
    expect(getNormalizedAssetExtension("image", true)).toBe(".png");
    expect(getAssetNormalizationArgs({ kind: "image", input: "upload.png", output, fps: 30, hasAlpha: true })).toEqual(
      expect.arrayContaining(["-c:v", "png", output]),
    );
  });

  it("uses VP9 WebM with an alpha pixel format for transparent videos", () => {
    const output = "normalized/asset.webm";
    const args = getAssetNormalizationArgs({ kind: "video", input: "upload.mov", output, fps: 30, hasAlpha: true });

    expect(getNormalizedAssetExtension("video", true)).toBe(".webm");
    expect(args).toEqual(expect.arrayContaining(["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p"]));
    expect(args).toEqual(expect.arrayContaining(["-metadata:s:v:0", "alpha_mode=1"]));
  });

  it("keeps the existing MP4 and JPEG paths for opaque media", () => {
    expect(getNormalizedAssetExtension("video", false)).toBe(".mp4");
    expect(getNormalizedAssetExtension("image", false)).toBe(".jpg");
  });
});
