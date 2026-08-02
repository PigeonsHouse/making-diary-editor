import { describe, expect, it } from "vitest";
import { getWavDurationSeconds } from "./wav";

function createPcmWav(dataBytes: number, byteRate = 48_000) {
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    value.split("").forEach((character, index) => {
      bytes[offset + index] = character.charCodeAt(0);
    });
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24_000, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
}

describe("getWavDurationSeconds", () => {
  it("PCM WAVの実データから再生時間を算出する", () => {
    expect(getWavDurationSeconds(createPcmWav(45_056))).toBeCloseTo(0.9386666667);
  });

  it("音声データが空のWAVを拒否する", () => {
    expect(getWavDurationSeconds(createPcmWav(0))).toBeNull();
  });

  it("途中で切れたWAVを拒否する", () => {
    expect(getWavDurationSeconds(createPcmWav(10).subarray(0, 44))).toBeNull();
  });
});
