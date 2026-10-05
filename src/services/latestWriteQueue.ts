// Serialize native writes and replace waiting requests with the latest choice.
// A superseded reply must not overwrite the state already shown by the UI.
export function createLatestWriteQueue<T, R>(
  write: (value: T) => Promise<R>,
  settled: (value: T, result: R | undefined, error: unknown | undefined) => void,
) {
  let pending: { value: T; revision: number } | undefined;
  let revision = 0;
  let running = false;
  let disposed = false;
  async function drain() {
    running = true;
    try {
      while (pending && !disposed) {
        const request = pending;
        pending = undefined;
        let result: R | undefined;
        let error: unknown;
        try { result = await write(request.value); } catch (failure) { error = failure; }
        if (!disposed && request.revision === revision) settled(request.value, result, error);
      }
    } finally { running = false; }
  }
  return {
    enqueue(value: T) {
      if (disposed) return;
      pending = { value, revision: ++revision };
      if (!running) void drain();
    },
    dispose() { disposed = true; pending = undefined; },
  };
}
