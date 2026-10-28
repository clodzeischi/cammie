import type { CarveInput, SimRequest, SimResponse } from '../../workers/sim.worker';

/** Cells for the 3D view: ~0.2 mm on a 200 × 150 mm stock, light enough to orbit smoothly. */
export const VIEW_MAX_CELLS = 600_000;
/** A rough pass (~0.5 mm cells): quick enough to follow a shape being dragged. */
export const QUICK_MAX_CELLS = 100_000;

/**
 * Keeps the 3D view up to date with the design. Whenever the worker is free
 * it carves the newest design: a rough pass, then (if nothing changed
 * meanwhile) the full one. While a shape is dragged that's a stream of rough
 * passes; once it stops, the full result follows.
 */
export interface LiveCarver {
  update(input: CarveInput): void;
  dispose(): void;
}

export function createLiveCarver(
  show: (result: SimResponse, input: CarveInput, full: boolean) => void,
  onBusy: (busy: boolean) => void,
): LiveCarver {
  const worker = new Worker(new URL('../../workers/sim.worker.ts', import.meta.url), {
    type: 'module',
  });
  let nextId = 0;
  let pending: ((result: SimResponse | null) => void) | null = null;
  worker.onmessage = (event: MessageEvent<SimResponse>) => {
    pending?.(event.data);
    pending = null;
  };
  const run = (input: CarveInput, maxCells: number) =>
    new Promise<SimResponse | null>((resolve) => {
      pending = resolve;
      worker.postMessage({ id: ++nextId, input, maxCells } satisfies SimRequest);
    });

  let latest: CarveInput | null = null;
  let version = 0;
  let running = false;
  let disposed = false;

  const loop = async () => {
    running = true;
    onBusy(true);
    while (latest && !disposed) {
      const input = latest;
      const seen = version;
      const quick = await run(input, QUICK_MAX_CELLS);
      if (!quick) break;
      show(quick, input, false);
      if (seen !== version) continue; // changed again: carve the newest roughly first
      const full = await run(input, VIEW_MAX_CELLS);
      if (!full) break;
      show(full, input, true);
      if (seen === version) latest = null;
    }
    running = false;
    if (!disposed) onBusy(false);
  };

  return {
    update(input) {
      latest = input;
      version++;
      if (!running) void loop();
    },
    dispose() {
      disposed = true;
      worker.terminate();
      pending?.(null);
      pending = null;
    },
  };
}
