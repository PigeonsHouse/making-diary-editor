import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiError } from "./http";
import { fetchVoicevox } from "./voicevox";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchVoicevox", () => {
  it("maps an upstream input error to app 400 with a useful message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "発音記号の形式が不正です" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const error = await fetchVoicevox(
      new URL("http://voicevox/accent_phrases"),
      { method: "POST" },
      {
        operation: "kana解析",
        invalidInputMessage: "kanaの形式が不正です",
      },
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    const response = apiError(error);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "kanaの形式が不正です",
      details: { upstreamStatus: 400, upstreamError: "発音記号の形式が不正です" },
    });
  });

  it("maps an upstream server error to app 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 503 })));

    const error = await fetchVoicevox(new URL("http://voicevox/synthesis"), undefined, {
      operation: "音声合成",
    }).catch((caught) => caught);

    expect(error).toMatchObject({ status: 502, message: "VOICEVOXの音声合成に失敗しました" });
  });

  it("maps a connection failure to app 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const error = await fetchVoicevox(new URL("http://voicevox/speakers"), undefined, {
      operation: "話者一覧取得",
    }).catch((caught) => caught);

    expect(error).toMatchObject({ status: 502, message: "VOICEVOXに接続できません" });
  });

  it("times out an unresponsive VOICEVOX request", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VOICEVOX_TIMEOUT_MS", "50");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      ),
    );

    const request = fetchVoicevox(new URL("http://voicevox/synthesis"), undefined, { operation: "音声合成" }).catch(
      (caught) => caught,
    );
    await vi.advanceTimersByTimeAsync(50);

    await expect(request).resolves.toMatchObject({ status: 504, message: "VOICEVOXの音声合成がタイムアウトしました" });
  });
});
