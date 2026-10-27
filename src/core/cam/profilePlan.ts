import type { Path, Vec2 } from '../geometry/path';
import { applyMatrix, toMatrix } from '../geometry/transform';
import type { CutFrame } from '../job/faces';
import type { DesignObject, ProfileOperation } from '../job/job';
import type { Feeds } from '../materials/materials';
import type { Bit } from '../tools/bits';
import type { PlanResult } from './cutPlan';
import { profilePaths } from './profile';
import type { Diagnostic } from './program';
import { Loop } from './toolpath/loop';
import { finishingDepths, passDepths } from './toolpath/passes';
import { autoTabCount, autoTabPositions } from './toolpath/tabs';
import type { TabPlan } from './toolpath/cutLoops';

type Report = (severity: Diagnostic['severity'], message: string) => void;

export interface ProfilePlanInput {
  object: DesignObject;
  operation: ProfileOperation;
  bit: Bit;
  feeds: Feeds;
  /** Source paths in machine coordinates. */
  paths: Path[];
  thickness: number;
  frame: CutFrame;
}

/** Default tab length along the path: room for a 4 mm tab plus the bit on each side. */
export const defaultTabWidth = (bit: Bit) => 4 + bit.diameter;

/**
 * Plans a profile cut: roughing loops (offset by the finishing allowance, if
 * any), finishing loops at the final size, and tabs on the finished contour.
 */
export function planProfile(input: ProfilePlanInput, report: Report): PlanResult | null {
  const { operation, bit, feeds, paths } = input;
  const finishing =
    operation.side !== 'on' && operation.finishing.enabled && operation.finishing.allowance > 0;
  const allowance = finishing ? operation.finishing.allowance : 0;

  const rough = profilePaths(
    paths,
    operation.side,
    bit.diameter + 2 * allowance,
    operation.direction,
  );
  const final = finishing
    ? profilePaths(paths, operation.side, bit.diameter, operation.direction)
    : rough;
  if (rough.paths.length === 0 || final.paths.length === 0) {
    report('warning', `it's too small for the ${bit.name}, so nothing will be cut.`);
    return null;
  }
  if (final.lostDetail || rough.lostDetail) {
    report(
      'warning',
      `some details are narrower than the ${bit.name} and won't come out as drawn.`,
    );
  }

  const tabs = operation.side === 'on' ? null : planTabs(input, final.paths, allowance, report);
  const groups = [
    {
      paths: rough.paths,
      depths: passDepths(operation.depth, feeds.depthPerPass),
      entry: operation.entry,
      tabs,
    },
  ];
  if (finishing) {
    groups.push({
      paths: final.paths,
      depths: finishingDepths(operation.depth, feeds.depthPerPass),
      entry: 'plunge' as const,
      tabs,
    });
  }

  const { toCanvas } = input.frame;
  return {
    plan: { kind: 'loops', groups },
    allPaths: [...rough.paths, ...(finishing ? final.paths : [])],
    tabs:
      operation.side === 'on'
        ? null
        : {
            loops: final.paths.map((p) => ({ closed: true, points: p.points.map(toCanvas) })),
            centres: (tabs?.points ?? []).map(toCanvas),
          },
    tabsHold: (tabs?.points.length ?? 0) > 0,
  };
}

function planTabs(
  input: ProfilePlanInput,
  finalLoops: Path[],
  allowance: number,
  report: Report,
): TabPlan | null {
  const { operation, bit, thickness, object, frame } = input;
  const settings = operation.tabs;
  if (!settings.enabled) return null;
  const tabZ = -(thickness - settings.height);
  if (settings.height >= thickness) {
    report('warning', 'tab height is not less than the stock thickness, so tabs are skipped.');
    return null;
  }
  if (operation.depth <= thickness - settings.height) return null; // the cut never reaches the tabs

  const width = settings.width ?? defaultTabWidth(bit);
  let points: Vec2[];
  if (settings.manual) {
    const m = toMatrix(object.transform);
    points = settings.manual.map((p) => frame.toMachine(applyMatrix(m, p)));
  } else {
    points = finalLoops.flatMap((path) => {
      const loop = new Loop(path);
      const count = settings.count ?? autoTabCount(loop.perimeter, width);
      return autoTabPositions(loop, count, width).map((s) => loop.pointAt(s));
    });
  }
  return { points, width, z: tabZ, snapDistance: bit.diameter + allowance };
}
