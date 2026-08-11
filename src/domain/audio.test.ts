import { describe, expect, it } from "vitest";
import { getBgmVolume, groupContinuousBgm, resolveAudioClip, resolveSoundEffect } from "./audio";

const projectDefault = {
  assetId: "00000000-0000-4000-8000-000000000001",
  url: "/api/files/assets/00000000-0000-4000-8000-000000000001",
  volumeOverride: null,
};
const resolvedDefault = resolveAudioClip(projectDefault, { [projectDefault.assetId]: 0.8 });

describe("resolveSoundEffect", () => {
  it("inherits the project default", () => {
    expect(resolveSoundEffect(projectDefault, { mode: "inherit" }, { [projectDefault.assetId]: 0.8 })).toEqual(
      resolvedDefault,
    );
  });

  it("can explicitly disable the sound", () => {
    expect(resolveSoundEffect(projectDefault, { mode: "none" })).toBeNull();
  });

  it("uses a custom sound instead of the project default", () => {
    const custom = { ...projectDefault, volumeOverride: 0.4 };
    expect(resolveSoundEffect(projectDefault, { mode: "custom", clip: custom })).toEqual({
      assetId: custom.assetId,
      url: custom.url,
      volume: 0.4,
    });
  });
});

describe("groupContinuousBgm", () => {
  it("keeps the same BGM running across adjacent scenes", () => {
    const segments = groupContinuousBgm([
      { key: "wish", from: 0, duration: 90, bgm: resolvedDefault },
      { key: "diary-1", from: 90, duration: 120, bgm: { ...resolvedDefault, volume: 0.5 } },
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ from: 0, duration: 210 });
    expect(getBgmVolume(segments[0], 89)).toBe(0.8);
    expect(getBgmVolume(segments[0], 90)).toBe(0.5);
  });

  it("starts a new loop after BGM is disabled or changed", () => {
    const other = { ...projectDefault, assetId: "00000000-0000-4000-8000-000000000002" };
    const segments = groupContinuousBgm([
      { key: "a", from: 0, duration: 30, bgm: resolvedDefault },
      { key: "b", from: 30, duration: 30, bgm: null },
      { key: "c", from: 60, duration: 30, bgm: resolvedDefault },
      { key: "d", from: 90, duration: 30, bgm: { ...resolvedDefault, assetId: other.assetId } },
    ]);

    expect(segments.map(({ from, duration }) => ({ from, duration }))).toEqual([
      { from: 0, duration: 30 },
      { from: 60, duration: 30 },
      { from: 90, duration: 30 },
    ]);
  });

  it("mutes sections without restarting a continuous BGM", () => {
    const segments = groupContinuousBgm([
      { key: "a", from: 0, duration: 30, bgm: resolvedDefault, mutedSections: [{ from: 10, duration: 8 }] },
      { key: "b", from: 30, duration: 20, bgm: resolvedDefault },
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ from: 0, duration: 50 });
    expect(getBgmVolume(segments[0], 9)).toBe(0.8);
    expect(getBgmVolume(segments[0], 10)).toBe(0);
    expect(getBgmVolume(segments[0], 17)).toBe(0);
    expect(getBgmVolume(segments[0], 18)).toBe(0.8);
    expect(getBgmVolume(segments[0], 35)).toBe(0.8);
  });
});
