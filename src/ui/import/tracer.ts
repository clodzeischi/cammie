import type { GrayBitmap } from '../../core/trace/grayBitmap';
import { traceImage, type TraceOptions, type TraceResult } from '../../core/trace/traceImage';
import type { TraceRequest, TraceResponse } from '../../workers/trace.worker';

/** Traces one loaded bitmap with different settings. */
export interface Tracer {
  /** Resolves with the result, or null if a newer request replaced this one. */
  trace(options: TraceOptions): Promise<TraceResult | null>;
  dispose(): void;
}

/** Traces in a Web Worker so dragging a slider never freezes the page. */
export function createWorkerTracer(bitmap: GrayBitmap): Tracer {
  const worker = new Worker(new URL('../../workers/trace.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.postMessage({ type: 'load', bitmap } satisfies TraceRequest);

  let latest = 0;
  const pending = new Map<number, (result: TraceResult | null) => void>();
  worker.onmessage = (event: MessageEvent<TraceResponse>) => {
    const { id, result } = event.data;
    pending.get(id)?.(id === latest ? result : null);
    pending.delete(id);
  };

  return {
    trace(options) {
      const id = ++latest;
      // Older requests still in flight will resolve as stale.
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage({ type: 'trace', id, options } satisfies TraceRequest);
      });
    },
    dispose() {
      worker.terminate();
      pending.forEach((resolve) => resolve(null));
      pending.clear();
    },
  };
}

/** Same contract on the main thread; for tests and browsers without module workers. */
export function createInlineTracer(bitmap: GrayBitmap): Tracer {
  return {
    trace: async (options) => traceImage(bitmap, options),
    dispose: () => {},
  };
}
