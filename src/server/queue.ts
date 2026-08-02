import {Queue} from "bullmq";
import IORedis from "ioredis";

const globalQueue = globalThis as unknown as {
  redis?: IORedis;
  renderQueue?: Queue;
};

export const redis =
  globalQueue.redis ?? new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {maxRetriesPerRequest: null});
export const renderQueue = globalQueue.renderQueue ?? new Queue("renders", {connection: redis});
export const assetQueue = new Queue("assets", {connection: redis});

if (process.env.NODE_ENV !== "production") {
  globalQueue.redis = redis;
  globalQueue.renderQueue = renderQueue;
}
