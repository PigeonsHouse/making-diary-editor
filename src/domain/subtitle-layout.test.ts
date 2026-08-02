import { describe, expect, it } from "vitest";
import { layoutSubtitleText, segmentSubtitlePhrases, SUBTITLE_LAYOUT } from "./subtitle-layout";

describe("segmentSubtitlePhrases", () => {
  it("助詞と助動詞を直前の語から分離しない", () => {
    expect(segmentSubtitlePhrases("これはペンです。名詞と助詞の間です")).toEqual([
      "これは",
      "ペンです。",
      "名詞と",
      "助詞の",
      "間です",
    ]);
  });

  it("括弧と句読点の内側では改行可能にしない", () => {
    expect(segmentSubtitlePhrases("「自然な改行」です。")).toEqual(["「自然な", "改行」です。"]);
  });

  it("分割された短い活用部分を次の語へまとめる", () => {
    expect(segmentSubtitlePhrases("端からはみ出さない")).toEqual(["端からは", "み出さない"]);
  });
});

describe("layoutSubtitleText", () => {
  it("短い字幕では既定のフォントサイズを維持する", () => {
    expect(layoutSubtitleText("短い字幕")).toEqual({ lines: ["短い字幕"], fontSize: SUBTITLE_LAYOUT.maxFontSize });
  });

  it("長い字幕を語の途中で切らず、字幕矩形に合わせて縮小する", () => {
    const text = "とても長い字幕が画面の端からはみ出さないように自然な位置で改行されます";
    const layout = layoutSubtitleText(text.repeat(2));

    expect(layout.fontSize).toBeLessThan(SUBTITLE_LAYOUT.maxFontSize);
    expect(layout.lines.join("")).toBe(text.repeat(2));
    for (const phrase of segmentSubtitlePhrases(text.repeat(2))) {
      expect(layout.lines.some((line) => line.includes(phrase))).toBe(true);
    }
  });

  it("鉤括弧内の改行を避けるため、必要な範囲でフォントを縮小する", () => {
    const text = "前置きの文章です。「引用部分はなるべく一行にまとめたい文章です。」後ろです。";
    const layout = layoutSubtitleText(text);
    const openingQuote = text.indexOf("「");
    const closingQuote = text.indexOf("」");
    let breakPosition = 0;

    expect(layout.fontSize).toBeLessThan(SUBTITLE_LAYOUT.maxFontSize);
    for (const line of layout.lines.slice(0, -1)) {
      breakPosition += line.length;
      expect(breakPosition <= openingQuote || breakPosition > closingQuote).toBe(true);
    }
  });

  it("句読点で切ると行長が2倍以上違う場合はバランスを取り直す", () => {
    const layout = layoutSubtitleText("短い文です。こちらは少し長めに書かれた二つ目の文章です。");

    expect(layout.lines).toEqual(["短い文です。こちらは少し長めに", "書かれた二つ目の文章です。"]);
    const lengths = layout.lines.map((line) => [...line].length);
    expect(Math.max(...lengths)).toBeLessThan(Math.min(...lengths) * 2);
  });

  it("行長の均等化より助詞直後の改行を少し優先する", () => {
    const layout = layoutSubtitleText("この文章では自然な場所で改行位置を選びたいと思いますので確認します");

    expect(layout.lines[0]).toBe("この文章では自然な場所で改行位置を");
  });

  it("鉤括弧の直前または直後を優先改行位置として扱う", () => {
    const layout = layoutSubtitleText("前置きです「引用部分は一行にします」後ろにも文章を続けます");

    expect(layout.lines[0].endsWith("」") || layout.lines[1].startsWith("「")).toBe(true);
  });
});
