import { describe, expect, it } from "vitest";
import { parseByteRange } from "./byte-range";

describe("parseByteRange", () => {
  it("開始・終了位置を解釈する", () => {
    expect(parseByteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(parseByteRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("末尾からの範囲を解釈する", () => {
    expect(parseByteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("ファイル外または複数範囲を拒否する", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBeNull();
    expect(parseByteRange("bytes=0-1,4-5", 1000)).toBeNull();
  });
});
