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
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError(502, "VOICEVOXに接続できません");
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
