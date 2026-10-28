import type { BitProgram } from '../../core/cam/program';
import type { Job } from '../../core/job/job';
import type { SimRequest, SimResponse } from '../../workers/sim.worker';

/** Cells for the 3D view: ~0.2 mm on a 200 × 150 mm stock, light enough to orbit smoothly. */
export const VIEW_MAX_CELLS = 600_000;

export interface Simulator {
  /** Resolves with the carved stock, or null if a newer request replaced this one. */
  run(job: SimRequest['job'], programs: BitProgram[]): Promise<SimResponse | null>;
  dispose(): void;
}

/** Carves in a Web Worker so editing never waits on the 3D view. */
export function createSimulator(): Simulator {
  const worker = new Worker(new URL('../../workers/sim.worker.ts', import.meta.url), {
    type: 'module',
  });
  let latest = 0;
  const pending = new Map<number, (result: SimResponse | null) => void>();
  worker.onmessage = (event: MessageEvent<SimResponse>) => {
    const { id } = event.data;
    pending.get(id)?.(id === latest ? event.data : null);
    pending.delete(id);
  };
  return {
    run(job: Pick<Job, 'stock' | 'origin' | 'flip'>, programs) {
      const id = ++latest;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker.postMessage({ id, job, programs, maxCells: VIEW_MAX_CELLS } satisfies SimRequest);
      });
    },
    dispose() {
      worker.terminate();
      pending.forEach((resolve) => resolve(null));
      pending.clear();
    },
  };
}
