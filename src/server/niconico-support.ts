import { z } from "zod";
import type { SupportCreditsCache, SupportVideoConfig } from "@/domain/types";
import { ApiError } from "./http";

const videoIdPattern = /^[a-z]{2}[1-9][0-9]*$/;
const pageSchema = z.object({
  meta: z.object({ status: z.number() }),
  data: z.object({
    nextCount: z.number().int().nonnegative(),
    histories: z.array(z.record(z.string(), z.unknown())),
  }),
});
const adSchema = z.object({
  id: z.number().int(),
  supporterId: z.number().int().nullable().optional(),
  supporterName: z.string().min(1),
  point: z.number().nonnegative(),
  startedAt: z.number().int(),
});
const giftSchema = z.object({
  id: z.number().int(),
  supporterId: z.number().int().nullable().optional(),
  supporterName: z.string().min(1),
  publishedAt: z.number().int(),
});
const videoMetadataSchema = z.object({
  meta: z.object({ status: z.number() }),
  data: z.object({
    id: z.string(),
    title: z.string().min(1),
    thumbnailUrl: z.string().url(),
    ownerName: z.string().min(1),
  }),
});

type Fetch = typeof fetch;
type HistoryKind = "nicoad" | "gift";

async function fetchVideoMetadata(videoId: string, fetcher: Fetch) {
  const response = await fetcher(`https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}`, {
    cache: "no-store",
    headers: { "user-agent": "making-diary-editor/0.1" },
  });
  if (!response.ok) throw new ApiError(502, `${videoId}: 動画情報の取得に失敗しました (${response.status})`);
  const body = videoMetadataSchema.safeParse(await response.json());
  if (!body.success || body.data.meta.status !== 200 || body.data.data.id !== videoId) {
    throw new ApiError(502, `${videoId}: 動画情報の形式が不正です`);
  }
  const { title, thumbnailUrl, ownerName } = body.data.data;
  return { title, thumbnailUrl, ownerName };
}

async function fetchAllHistories(
  videoId: string,
  kind: HistoryKind,
  timestampKey: "startedAt" | "publishedAt",
  startEpoch: number | null,
  fetcher: Fetch,
) {
  const histories: Record<string, unknown>[] = [];
  let offsetId: number | null = null;
  const seenOffsets = new Set<number>();
  const seenHistoryIds = new Set<number>();
  for (let pageNumber = 0; pageNumber < 10_000; pageNumber += 1) {
    const url = new URL(
      `https://api.koken.nicovideo.jp/v1/userperspective/contents/${kind}/video/${videoId}/histories`,
    );
    url.searchParams.set("limit", "30");
    if (offsetId !== null) url.searchParams.set("offsetId", String(offsetId));
    const response = await fetcher(url, { cache: "no-store", headers: { "user-agent": "making-diary-editor/0.1" } });
    if (!response.ok)
      throw new ApiError(
        502,
        `${videoId}: ${kind === "gift" ? "ギフト" : "広告"}履歴の取得に失敗しました (${response.status})`,
      );
    const body = pageSchema.safeParse(await response.json());
    if (!body.success || body.data.meta.status !== 200) {
      throw new ApiError(502, `${videoId}: ${kind === "gift" ? "ギフト" : "広告"}履歴の形式が不正です`);
    }
    const page = body.data.data.histories;
    for (const item of page) {
      const id = typeof item.id === "number" ? item.id : null;
      if (id !== null && seenHistoryIds.has(id)) continue;
      if (id !== null) seenHistoryIds.add(id);
      histories.push(item);
    }
    if (body.data.data.nextCount === 0 || page.length === 0) return histories;
    const last = page.at(-1)!;
    const lastTimestamp = typeof last[timestampKey] === "number" ? last[timestampKey] : null;
    if (startEpoch !== null && lastTimestamp !== null && lastTimestamp < startEpoch) return histories;
    const nextOffset = typeof last.id === "number" ? last.id : null;
    if (nextOffset === null || seenOffsets.has(nextOffset)) {
      throw new ApiError(502, `${videoId}: 履歴のページングを継続できません`);
    }
    seenOffsets.add(nextOffset);
    offsetId = nextOffset;
  }
  throw new ApiError(502, `${videoId}: 履歴件数が上限を超えました`);
}

export async function fetchSupportCredits(
  videoConfigs: SupportVideoConfig[],
  options: { fetcher?: Fetch; now?: Date } = {},
): Promise<SupportCreditsCache> {
  const videoIds = videoConfigs.map((video) => video.videoId);
  if (videoConfigs.length === 0) throw new ApiError(400, "動画IDを1件以上指定してください");
  if (new Set(videoIds).size !== videoIds.length) throw new ApiError(400, "動画IDが重複しています");
  if (videoIds.some((id) => !videoIdPattern.test(id))) throw new ApiError(400, "動画IDの形式が不正です");
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const endEpoch = Math.floor(now.getTime() / 1000);

  const videos: SupportCreditsCache["videos"] = [];
  for (const { videoId, startDate } of videoConfigs) {
    const startEpoch = startDate === null ? null : Math.floor(new Date(`${startDate}T00:00:00+09:00`).getTime() / 1000);
    if (startEpoch !== null && (!Number.isFinite(startEpoch) || startEpoch > endEpoch)) {
      throw new ApiError(400, `${videoId}: 開始日は取得時刻以前の日付を指定してください`);
    }
    const [metadata, rawAds, rawGifts] = await Promise.all([
      fetchVideoMetadata(videoId, fetcher),
      fetchAllHistories(videoId, "nicoad", "startedAt", startEpoch, fetcher),
      fetchAllHistories(videoId, "gift", "publishedAt", startEpoch, fetcher),
    ]);
    const parsedAds = rawAds.map((item) => adSchema.safeParse(item));
    const parsedGifts = rawGifts.map((item) => giftSchema.safeParse(item));
    if (parsedAds.some((item) => !item.success)) throw new ApiError(502, `${videoId}: 広告履歴の形式が不正です`);
    if (parsedGifts.some((item) => !item.success)) throw new ApiError(502, `${videoId}: ギフト履歴の形式が不正です`);
    const ads = parsedAds
      .map((item) => item.data!)
      .filter((item) => (startEpoch === null || item.startedAt >= startEpoch) && item.startedAt <= endEpoch);
    const rawGiftItems = parsedGifts
      .map((item) => item.data!)
      .filter((item) => (startEpoch === null || item.publishedAt >= startEpoch) && item.publishedAt <= endEpoch);

    const advertiserMap = new Map<
      string,
      { supporterId: number | null; supporterName: string; totalPoint: number; latestAt: number }
    >();
    for (const ad of ads) {
      const supporterId = ad.supporterId ?? null;
      const key = supporterId === null ? `name:${ad.supporterName}` : `id:${supporterId}`;
      const current = advertiserMap.get(key);
      advertiserMap.set(key, {
        supporterId,
        supporterName: !current || ad.startedAt >= current.latestAt ? ad.supporterName : current.supporterName,
        totalPoint: (current?.totalPoint ?? 0) + ad.point,
        latestAt: Math.max(current?.latestAt ?? Number.NEGATIVE_INFINITY, ad.startedAt),
      });
    }
    const advertisers = [...advertiserMap.values()]
      .filter((item) => item.supporterName !== metadata.ownerName)
      .sort((a, b) => b.totalPoint - a.totalPoint || a.supporterName.localeCompare(b.supporterName, "ja"))
      .map(({ latestAt: _latestAt, ...item }) => item);
    const gifts = rawGiftItems
      .sort((a, b) => a.publishedAt - b.publishedAt || a.id - b.id)
      .map((item) => ({
        id: item.id,
        supporterId: item.supporterId ?? null,
        supporterName: item.supporterName,
        publishedAt: item.publishedAt,
      }));
    videos.push({ videoId, startDate, ...metadata, advertisers, gifts });
  }
  return { fetchedAt: now.toISOString(), videos };
}
