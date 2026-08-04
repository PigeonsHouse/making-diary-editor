import { redis } from "./queue";

const cancellationKey = (renderJobId: string) => `render:cancel:${renderJobId}`;

export const requestRenderCancellation = async (renderJobId: string) => {
  await redis.set(cancellationKey(renderJobId), "1", "EX", 60 * 60);
};

export const isRenderCancellationRequested = async (renderJobId: string) => {
  return (await redis.exists(cancellationKey(renderJobId))) === 1;
};

export const clearRenderCancellation = async (renderJobId: string) => {
  await redis.del(cancellationKey(renderJobId));
};

export function watchRenderCancellation(renderJobId: string, onCancellation: () => void, intervalMs = 250) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const poll = async () => {
    try {
      if (await isRenderCancellationRequested(renderJobId)) {
        stopped = true;
        onCancellation();
        return;
      }
    } catch (error) {
      console.error(`[render:${renderJobId}] Failed to check cancellation`, error);
    }
    if (!stopped) timer = setTimeout(() => void poll(), intervalMs);
  };

  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
