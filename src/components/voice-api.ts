export type VoiceRequestInput = {
  text: string;
  kana?: string | null;
  voicevoxName: string;
  styleName: string;
  speed: number;
  pitch: number;
  intonation: number;
  volume: number;
};

export type VoiceRequestResult = {
  hash: string;
  url: string;
  durationSeconds: number;
};

type SendVoiceRequest = (input: VoiceRequestInput) => Promise<VoiceRequestResult>;
type VoiceFlight = {
  promise: Promise<VoiceRequestResult>;
  started: boolean;
  startListeners: Set<() => void>;
};

export type VoiceRequestOptions = {
  onStart?: () => void;
};

export function createVoiceRequester(concurrency: number, send: SendVoiceRequest) {
  const limit = Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 2;
  const pending: Array<() => void> = [];
  const flights = new Map<string, VoiceFlight>();
  let active = 0;

  const schedule = async (task: () => Promise<VoiceRequestResult>) => {
    await new Promise<void>((resolve) => {
      if (active < limit) {
        active += 1;
        resolve();
      } else {
        pending.push(() => {
          active += 1;
          resolve();
        });
      }
    });
    try {
      return await task();
    } finally {
      active -= 1;
      pending.shift()?.();
    }
  };

  return (input: VoiceRequestInput, options: VoiceRequestOptions = {}) => {
    const key = JSON.stringify(input);
    const current = flights.get(key);
    if (current) {
      if (options.onStart) {
        if (current.started) queueMicrotask(options.onStart);
        else current.startListeners.add(options.onStart);
      }
      return current.promise;
    }
    const flight: VoiceFlight = {
      promise: Promise.resolve(null as never),
      started: false,
      startListeners: new Set(options.onStart ? [options.onStart] : []),
    };
    const promise = schedule(() => {
      flight.started = true;
      for (const listener of flight.startListeners) listener();
      flight.startListeners.clear();
      return send(input);
    }).finally(() => {
      if (flights.get(key) === flight) flights.delete(key);
    });
    flight.promise = promise;
    flights.set(key, flight);
    return promise;
  };
}

const sendVoiceRequest: SendVoiceRequest = async (input) => {
  const response = await fetch("/api/voice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = (await response.json()) as VoiceRequestResult & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "音声生成に失敗しました");
  return result;
};

export const requestVoice = createVoiceRequester(2, sendVoiceRequest);
