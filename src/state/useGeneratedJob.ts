import { useMemo } from 'react';
import { generateJob } from '../core/cam/generateJob';
import type { GeneratedJob } from '../core/cam/program';
import type { Job } from '../core/job/job';
import { useJobStore } from './jobStore';
import { useMachineStore } from './machineStore';

/** The current design's job data (stable while nothing changes). */
export function useJob(): Job {
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const materialId = useJobStore((s) => s.materialId);
  const objects = useJobStore((s) => s.objects);
  return useMemo(
    () => ({ stock, origin, materialId, objects }),
    [stock, origin, materialId, objects],
  );
}

/**
 * Toolpaths and diagnostics for the current design, recomputed when the design
 * or machine changes. Engraving is cheap enough for the main thread; heavier
 * operations (pocket, V-carve) will move this into a worker.
 */
export function useGeneratedJob(): GeneratedJob {
  const job = useJob();
  const machine = useMachineStore((s) => s.config);
  return useMemo(() => generateJob(job, machine), [job, machine]);
}
