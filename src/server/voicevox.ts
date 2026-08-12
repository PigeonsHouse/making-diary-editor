import { ApiError } from "./http";

type VoicevoxRequestOptions = {
  operation: string;
  invalidInputMessage?: string;
};

export async function fetchVoicevox(
  input: URL,
  init: RequestInit | undefined,
  { operation, invalidInputMessage }: VoicevoxRequestOptions,
) {
  let response: Response;
  const controller = new AbortController();
  const timeoutMs = voicevoxTimeoutMs();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  try {
    response = await fetch(input, { ...init, signal });
  } catch {
    if (timedOut) throw new ApiError(504, `VOICEVOXの${operation}がタイムアウトしました`);
    throw new ApiError(502, "VOICEVOXに接続できません");
  } finally {
    clearTimeout(timeout);
  }
  if (response.ok) return response;

  const upstreamError = await readVoicevoxError(response);
  if (invalidInputMessage && response.status >= 400 && response.status < 500) {
    throw new ApiError(400, invalidInputMessage, {
      upstreamStatus: response.status,
      upstreamError,
    });
  }
  throw new ApiError(502, `VOICEVOXの${operation}に失敗しました`, {
    upstreamStatus: response.status,
    upstreamError,
  });
}

function voicevoxTimeoutMs() {
  const value = Number(process.env.VOICEVOX_TIMEOUT_MS ?? "120000");
  return Number.isFinite(value) && value > 0 ? value : 120_000;
}

async function readVoicevoxError(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    return body.detail ?? body;
  } catch {
    return text.slice(0, 500);
  }
}
