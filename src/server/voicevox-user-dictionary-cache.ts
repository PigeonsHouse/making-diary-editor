import { fetchVoicevox } from "./voicevox";

const CACHE_TTL_MS = 1_000;

type DictionaryCache = {
  host: string | null;
  value: unknown;
  expiresAt: number;
  inflight: Promise<unknown> | null;
  revision: number;
};

const globalCache = globalThis as typeof globalThis & {
  __makingDiaryVoicevoxDictionaryCache?: DictionaryCache;
};

const cache = globalCache.__makingDiaryVoicevoxDictionaryCache ?? {
  host: null,
  value: null,
  expiresAt: 0,
  inflight: null,
  revision: 0,
};

globalCache.__makingDiaryVoicevoxDictionaryCache = cache;

export function invalidateVoicevoxUserDictionaryCache() {
  cache.revision += 1;
  cache.host = null;
  cache.value = null;
  cache.expiresAt = 0;
  cache.inflight = null;
}

export async function getVoicevoxUserDictionary(host: string) {
  if (cache.host === host && cache.value !== null && cache.expiresAt > Date.now()) return cache.value;
  if (cache.host === host && cache.inflight) return cache.inflight;

  cache.host = host;
  const revision = cache.revision;
  const request = fetchVoicevox(new URL("/user_dict", host), { cache: "no-store" }, { operation: "ユーザー辞書取得" })
    .then((response) => response.json())
    .then((dictionary) => {
      if (cache.revision === revision && cache.host === host) {
        cache.value = dictionary;
        cache.expiresAt = Date.now() + CACHE_TTL_MS;
      }
      return dictionary;
    })
    .finally(() => {
      if (cache.inflight === request) cache.inflight = null;
    });
  cache.inflight = request;
  return request;
}
