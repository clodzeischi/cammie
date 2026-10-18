import type { Path } from '../geometry/path';
import type { PocketOperation } from '../job/job';
import type { Feeds } from '../materials/materials';
import type { Bit } from '../tools/bits';
import type { PlanResult } from './cutPlan';
import { pocketRings } from './pocket';
import type { Diagnostic } from './program';
import { finishingDepths, passDepths } from './toolpath/passes';

type Report = (severity: Diagnostic['severity'], message: string) => void;

/** Plans a pocket: clearing rings, then (optionally) a finishing pass on the walls. */
export function planPocket(
  operation: PocketOperation,
  bit: Bit,
  feeds: Feeds,
  paths: Path[],
  report: Report,
): PlanResult | null {
  const allowance = operation.finishing.enabled ? Math.max(0, operation.finishing.allowance) : 0;
  const rings = pocketRings(paths, bit.diameter, feeds.stepover, allowance, operation.direction);
  if (rings.levels.length === 0) {
    report('warning', `it's too small for the ${bit.name}, so nothing will be cut.`);
    return null;
  }
  if (rings.lostDetail) {
    report('warning', `some areas are narrower than the ${bit.name} and won't be cleared.`);
  }
  return {
    plan: {
      kind: 'pocket',
      rings,
      depths: passDepths(operation.depth, feeds.depthPerPass),
      entry: operation.entry,
      finish:
        rings.finish.length > 0
          ? {
              paths: rings.finish,
              depths: finishingDepths(operation.depth, feeds.depthPerPass),
              entry: 'plunge',
              tabs: null,
            }
          : null,
    },
    allPaths: [...rings.levels[0]!, ...rings.finish],
    tabs: null,
    tabsHold: false,
  };
}
