import { describe, expect, it, vi } from "vitest";
import { createVoiceRequester, type VoiceRequestInput, type VoiceRequestResult } from "./voice-api";

const input = (text: string): VoiceRequestInput => ({
  text,
  kana: null,
  voicevoxName: "ずんだもん",
  styleName: "ノーマル",
  speed: 1,
  pitch: 0,
  intonation: 1,
  volume: 1,
});

const deferred = () => {
  let resolve!: (value: VoiceRequestResult) => void;
  const promise = new Promise<VoiceRequestResult>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe("voice API requester", () => {
  it("keeps only the configured number of API requests active", async () => {
    const completions = [deferred(), deferred(), deferred()];
    const send = vi.fn((request: VoiceRequestInput) => completions[Number(request.text)].promise);
    const requestVoice = createVoiceRequester(2, send);

    const requests = [requestVoice(input("0")), requestVoice(input("1")), requestVoice(input("2"))];
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(send).toHaveBeenCalledTimes(2);
    completions[0].resolve({ hash: "0", url: "/0.wav", durationSeconds: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(send).toHaveBeenCalledTimes(3);
    completions[1].resolve({ hash: "1", url: "/1.wav", durationSeconds: 1 });
    completions[2].resolve({ hash: "2", url: "/2.wav", durationSeconds: 1 });
    await Promise.all(requests);
  });

  it("shares a request for identical voice input", async () => {
    const completion = deferred();
    const send = vi.fn(() => completion.promise);
    const requestVoice = createVoiceRequester(2, send);

    const first = requestVoice(input("same"));
    const second = requestVoice(input("same"));
    completion.resolve({ hash: "same", url: "/same.wav", durationSeconds: 1 });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reports start only after a queued request begins sending", async () => {
    const completions = [deferred(), deferred()];
    const send = vi.fn((request: VoiceRequestInput) => completions[Number(request.text)].promise);
    const requestVoice = createVoiceRequester(1, send);
    const firstStart = vi.fn();
    const secondStart = vi.fn();

    const first = requestVoice(input("0"), { onStart: firstStart });
    const second = requestVoice(input("1"), { onStart: secondStart });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstStart).toHaveBeenCalledTimes(1);
    expect(secondStart).not.toHaveBeenCalled();

    completions[0].resolve({ hash: "0", url: "/0.wav", durationSeconds: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(secondStart).toHaveBeenCalledTimes(1);
    completions[1].resolve({ hash: "1", url: "/1.wav", durationSeconds: 1 });
    await Promise.all([first, second]);
  });

  it("reports start to callers sharing an active request", async () => {
    const completion = deferred();
    const requestVoice = createVoiceRequester(1, () => completion.promise);
    const firstStart = vi.fn();
    const sharedStart = vi.fn();

    const first = requestVoice(input("same"), { onStart: firstStart });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const shared = requestVoice(input("same"), { onStart: sharedStart });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstStart).toHaveBeenCalledTimes(1);
    expect(sharedStart).toHaveBeenCalledTimes(1);

    completion.resolve({ hash: "same", url: "/same.wav", durationSeconds: 1 });
    await Promise.all([first, shared]);
  });
});
