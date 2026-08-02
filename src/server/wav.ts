const readAscii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

export function getWavDurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.byteLength < 12 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let byteRate: number | null = null;
  let dataBytes = 0;
  let offset = 12;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > bytes.byteLength) return null;

    if (chunkId === "fmt " && chunkSize >= 16) {
      byteRate = view.getUint32(chunkStart + 8, true);
    } else if (chunkId === "data") {
      dataBytes += chunkSize;
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!byteRate || dataBytes <= 0) return null;
  const durationSeconds = dataBytes / byteRate;
  return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null;
}
