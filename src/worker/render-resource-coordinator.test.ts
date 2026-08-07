import { describe, expect, it, vi } from "vitest";
import { createRenderResourceCoordinator } from "./render-resource-coordinator";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe("createRenderResourceCoordinator", () => {
  it("waits for active background work before allowing a render", async () => {
    const coordinator = createRenderResourceCoordinator();
    const preparation = deferred();
    const preparing = coordinator.runBackgroundWork(() => preparation.promise);
    await Promise.resolve();

    const lease = coordinator.reserveRender();
    let ready = false;
    void lease.ready.then(() => {
      ready = true;
    });
    await Promise.resolve();

    expect(lease.waitingForBackgroundWork).toBe(true);
    expect(ready).toBe(false);
    preparation.resolve();
    await preparing;
    await lease.ready;
    expect(ready).toBe(true);
    lease.release();
  });

  it("holds later background work until the render releases its reservation", async () => {
    const coordinator = createRenderResourceCoordinator();
    const lease = coordinator.reserveRender();
    const prepare = vi.fn(async () => undefined);
    const preparing = coordinator.runBackgroundWork(prepare);
    await Promise.resolve();

    expect(prepare).not.toHaveBeenCalled();
    lease.release();
    await preparing;
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("releases a render reservation only once", async () => {
    const coordinator = createRenderResourceCoordinator();
    const lease = coordinator.reserveRender();
    lease.release();
    lease.release();

    const prepare = vi.fn(async () => undefined);
    await coordinator.runBackgroundWork(prepare);
    expect(prepare).toHaveBeenCalledOnce();
  });
});
