type RenderResourceLease = {
  waitingForBackgroundWork: boolean;
  ready: Promise<void>;
  release: () => void;
};

export function createRenderResourceCoordinator() {
  let renderReservations = 0;
  let activeBackgroundWork: Promise<void> | null = null;
  let rendersIdle = Promise.resolve();
  let resolveRendersIdle: (() => void) | null = null;

  const reserveRender = (): RenderResourceLease => {
    if (renderReservations === 0) {
      rendersIdle = new Promise<void>((resolve) => {
        resolveRendersIdle = resolve;
      });
    }
    renderReservations += 1;
    const backgroundWork = activeBackgroundWork;
    let released = false;
    return {
      waitingForBackgroundWork: backgroundWork !== null,
      // A failed background job is reported by its own worker and must not strand rendering.
      ready: backgroundWork ?? Promise.resolve(),
      release: () => {
        if (released) return;
        released = true;
        renderReservations -= 1;
        if (renderReservations === 0) {
          resolveRendersIdle?.();
          resolveRendersIdle = null;
        }
      },
    };
  };

  const runBackgroundWork = async <T>(work: () => Promise<T>) => {
    while (renderReservations > 0 || activeBackgroundWork) {
      if (renderReservations > 0) await rendersIdle;
      else await activeBackgroundWork;
    }

    const operation = Promise.resolve().then(work);
    const completion = operation.then(
      () => undefined,
      () => undefined,
    );
    activeBackgroundWork = completion;
    try {
      return await operation;
    } finally {
      if (activeBackgroundWork === completion) activeBackgroundWork = null;
    }
  };

  return {
    reserveRender,
    runBackgroundWork,
    isRenderReserved: () => renderReservations > 0,
  };
}
