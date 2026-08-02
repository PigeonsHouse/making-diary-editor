import { describe, expect, it } from "vitest";
import { DEFAULT_RENDER_APP_URL, resolveRenderAssetUrls } from "./render-input";

describe("resolveRenderAssetUrls", () => {
  it("uses a Chromium-safe Docker hostname for API assets", () => {
    expect(
      resolveRenderAssetUrls(
        {
          image: "/api/files/psd/example.png",
          nested: ["/api/files/audio/example.wav", "https://example.com/keep.png"],
        },
        DEFAULT_RENDER_APP_URL,
      ),
    ).toEqual({
      image: "http://diary-web:3000/api/files/psd/example.png",
      nested: ["http://diary-web:3000/api/files/audio/example.wav", "https://example.com/keep.png"],
    });
  });
});
