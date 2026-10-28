import { useMemo } from 'react';
import { generateJob } from '../core/cam/generateJob';
import type { GeneratedJob } from '../core/cam/program';
import type { Job } from '../core/job/job';
import { useJobStore } from './jobStore';
import { useMachineStore } from './machineStore';
import { useToolingStore } from './toolingStore';

/** The current design's job data (stable while nothing changes). */
export function useJob(): Job {
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const materialId = useJobStore((s) => s.materialId);
  const objects = useJobStore((s) => s.objects);
  const toolpaths = useJobStore((s) => s.toolpaths);
  const flip = useJobStore((s) => s.flip);
  return useMemo(
    () => ({ stock, origin, materialId, objects, toolpaths, flip }),
    [stock, origin, materialId, objects, toolpaths, flip],
  );
}

type Inputs = Parameters<typeof generateJob>;

/** The last result, shared by every component that asks for the same inputs. */
let last: { keys: unknown[]; result: GeneratedJob } | null = null;

function generateShared(...inputs: Inputs): GeneratedJob {
  // Each component builds its own job object, so compare what it's made of.
  const [job, ...rest] = inputs;
  const keys = [...Object.values(job), ...rest];
  if (!last || keys.length !== last.keys.length || keys.some((k, i) => k !== last!.keys[i])) {
    last = { keys, result: generateJob(...inputs) };
  }
  return last.result;
}

/**
 * Toolpaths and diagnostics for the current design, recomputed when the design
 * machine, bits or remembered feeds change, once for all the panels that show
 * them. Even busy pockets and V-carves take well under 100 ms, so this runs on
 * the main thread.
 */
export function useGeneratedJob(): GeneratedJob {
  const job = useJob();
  const machine = useMachineStore((s) => s.config);
  const bits = useToolingStore((s) => s.bits);
  const feedOverrides = useToolingStore((s) => s.feedOverrides);
  return useMemo(
    () => generateShared(job, machine, bits, feedOverrides),
    [job, machine, bits, feedOverrides],
  );
}
