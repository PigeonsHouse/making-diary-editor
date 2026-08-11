import { describe, expect, it } from "vitest";
import { createBgmMutedSections } from "./bgm-mute";

describe("createBgmMutedSections", () => {
  it("ミュートしたセリフから次のセリフ開始までを消音する", () => {
    expect(
      createBgmMutedSections(30, 100, false, [
        { from: 30, muted: true },
        { from: 65, muted: false },
        { from: 90, muted: true },
      ]),
    ).toEqual([
      { from: 30, duration: 35 },
      { from: 90, duration: 40 },
    ]);
  });

  it("コンテンツ全体のミュートを優先する", () => {
    expect(createBgmMutedSections(30, 100, true, [{ from: 50, muted: false }])).toEqual([{ from: 30, duration: 100 }]);
  });
});
