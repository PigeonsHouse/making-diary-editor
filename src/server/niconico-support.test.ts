import { describe, expect, it } from "vitest";
import { fetchSupportCredits } from "./niconico-support";

const metadata = {
  meta: { status: 200 },
  data: {
    id: "sm123",
    title: "A & B",
    thumbnailUrl: "https://img.example/a.jpg",
    ownerName: "投稿者",
  },
};

describe("fetchSupportCredits", () => {
  it("filters, aggregates and orders histories", async () => {
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.nicoad.nicovideo.jp/v1/contents/video")) return Response.json(metadata);
      if (url.includes("/nicoad/")) {
        return Response.json({
          meta: { status: 200 },
          data: {
            nextCount: 0,
            histories: [
              { id: 3, supporterId: 10, supporterName: "新名", point: 300, startedAt: 1785558002 },
              { id: 2, supporterId: 10, supporterName: "旧名", point: 200, startedAt: 1785558001 },
              { id: 1, supporterId: 11, supporterName: "期間外", point: 900, startedAt: 1 },
              { id: 4, supporterId: 12, supporterName: "投稿者", point: 500, startedAt: 1785558003 },
            ],
          },
        });
      }
      return Response.json({
        meta: { status: 200 },
        data: {
          nextCount: 0,
          histories: [
            { id: 5, supporterId: 20, supporterName: "後", publishedAt: 1785558002 },
            { id: 4, supporterId: 20, supporterName: "先", publishedAt: 1785558001 },
          ],
        },
      });
    }) as typeof fetch;
    const result = await fetchSupportCredits([{ videoId: "sm123", startDate: "2026-08-01" }], {
      fetcher,
      now: new Date("2026-08-02T00:00:00Z"),
    });
    expect(result.videos[0].title).toBe("A & B");
    expect(result.videos[0].startDate).toBe("2026-08-01");
    expect(result.videos[0].ownerName).toBe("投稿者");
    expect(result.videos[0].advertisers).toEqual([{ supporterId: 10, supporterName: "新名", totalPoint: 500 }]);
    expect(result.videos[0].gifts.map((item) => item.supporterName)).toEqual(["先", "後"]);
  });

  it("follows offsetId pagination without double-counting repeated history ids", async () => {
    const requested: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("api.nicoad.nicovideo.jp/v1/contents/video")) return Response.json(metadata);
      if (url.includes("/gift/")) {
        return Response.json({ meta: { status: 200 }, data: { nextCount: 0, histories: [] } });
      }
      const offset = new URL(url).searchParams.get("offsetId");
      return Response.json(
        offset
          ? {
              meta: { status: 200 },
              data: {
                nextCount: 0,
                histories: [
                  { id: 20, supporterId: 1, supporterName: "広告主", point: 100, startedAt: 100 },
                  { id: 19, supporterId: 1, supporterName: "広告主", point: 200, startedAt: 90 },
                ],
              },
            }
          : {
              meta: { status: 200 },
              data: {
                nextCount: 1,
                histories: [{ id: 20, supporterId: 1, supporterName: "広告主", point: 100, startedAt: 100 }],
              },
            },
      );
    }) as typeof fetch;

    const result = await fetchSupportCredits([{ videoId: "sm123", startDate: null }], {
      fetcher,
      now: new Date("2030-01-01T00:00:00Z"),
    });
    expect(requested.some((url) => url.includes("offsetId=20"))).toBe(true);
    expect(result.videos[0].advertisers[0].totalPoint).toBe(300);
  });
});
