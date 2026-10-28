import type { Path } from '../geometry/path';
import type { ChamferOperation } from '../job/job';
import type { Feeds } from '../materials/materials';
import { chamferWidth, vbitMaxDepth, type VBit } from '../tools/bits';
import type { PlanResult } from './cutPlan';
import { profilePaths } from './profile';
import type { Diagnostic } from './program';
import { passDepths } from './toolpath/passes';

type Report = (severity: Diagnostic['severity'], message: string) => void;

const fmt = (mm: number) => `${Math.round(mm * 100) / 100} mm`;

/**
 * Plans a chamfer: the V-bit's tip runs just outside the edge (by half the
 * tip's flat), so the flat cuts down to the edge line and the cone bevels the
 * kept side. `outside` keeps the shape (bevels a part); `inside` keeps the
 * surroundings (bevels the rim of a hole). Paths are closed, in machine space.
 */
export function planChamfer(
  operation: ChamferOperation,
  bit: VBit,
  feeds: Feeds,
  paths: Path[],
  report: Report,
): PlanResult | null {
  const maxDepth = vbitMaxDepth(bit);
  if (operation.depth > maxDepth + 1e-9) {
    report(
      'error',
      `the chamfer is wider than the ${bit.name} can cut (${fmt(chamferWidth(bit, maxDepth))} at most). Make it narrower or pick a bigger bit.`,
    );
    return null;
  }

  const loops = profilePaths(paths, operation.side, bit.tipDiameter, operation.direction);
  if (loops.paths.length === 0) {
    report('warning', "it's too small to chamfer, so nothing will be cut.");
    return null;
  }
  if (loops.lostDetail) {
    report('warning', "some details are too small to chamfer and won't be cut.");
  }
  return {
    plan: {
      kind: 'loops',
      groups: [
        {
          paths: loops.paths,
          depths: passDepths(operation.depth, feeds.depthPerPass),
          entry: operation.entry,
          tabs: null,
        },
      ],
    },
    allPaths: loops.paths,
    tabs: null,
    tabsHold: false,
  };
}
