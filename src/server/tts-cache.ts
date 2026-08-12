import { createHash } from "node:crypto";

const TTS_CACHE_VERSION = "voicevox-user-dictionary-v1";

export function createTtsCacheHash(input: unknown, userDictionary: unknown) {
  return createHash("sha256")
    .update(TTS_CACHE_VERSION)
    .update(stableSerialize({ input, userDictionary }))
    .digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}
