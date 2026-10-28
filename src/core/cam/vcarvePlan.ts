import type { Path } from '../geometry/path';
import type { VCarveOperation } from '../job/job';
import type { Feeds } from '../materials/materials';
import { vbitMaxDepth, type VBit } from '../tools/bits';
import type { PlanResult } from './cutPlan';
import type { Diagnostic } from './program';
import { passDepths } from './toolpath/passes';
import { medialAxis } from './vcarve/medialAxis';

type Report = (severity: Diagnostic['severity'], message: string) => void;

const fmt = (mm: number) => `${Math.round(mm * 100) / 100} mm`;

/** The warning depth when the cut doesn't set one: half the stock. */
export const defaultWarnDepth = (thickness: number) => thickness / 2;

/**
 * Plans a V-carve (SPEC.md §9.5): the tool follows the shape's centre lines,
 * as deep as the cone must go to touch both walls there. Where a shape is
 * wider than the cone, the carve stops at the cone's full depth and the
 * middle is left. Paths are closed, in machine space.
 */
export function planVCarve(
  operation: VCarveOperation,
  bit: VBit,
  feeds: Feeds,
  paths: Path[],
  thickness: number,
  report: Report,
): (PlanResult & { depth: number }) | null {
  const { chains } = medialAxis(paths);
  const tanHalf = Math.tan((bit.angle * Math.PI) / 360);
  const coneDepth = vbitMaxDepth(bit);
  const depthAt = (r: number) => Math.max(0, r - bit.tipDiameter / 2) / tanHalf;

  const lines = chains.map((chain) =>
    chain.map((p) => ({ x: p.x, y: p.y, z: -Math.min(depthAt(p.r), coneDepth) })),
  );
  const widest = Math.max(0, ...chains.flat().map((p) => p.r));
  const deepest = Math.min(depthAt(widest), coneDepth);
  if (deepest <= 0) {
    report(
      'warning',
      bit.tipDiameter > 0
        ? `it's narrower than the ${bit.name}'s ${bit.tipDiameter} mm tip, so nothing will be carved. Use "On the line" instead.`
        : "it's too small to carve, so nothing will be cut.",
    );
    return null;
  }

  if (depthAt(widest) > coneDepth + 1e-9) {
    report(
      'warning',
      `is up to ${fmt(2 * widest)} wide, more than the ${bit.name} can carve (${fmt(bit.diameter)}). The middle of the wide parts is left uncarved; pocket them, or pick a bigger bit.`,
    );
  }
  // Every line thins to nothing into a corner; a stroke is thin when all of it is.
  const thinStroke = chains.some(
    (chain) => chain.length > 2 && Math.max(...chain.map((p) => p.r)) < bit.tipDiameter / 2,
  );
  if (bit.tipDiameter > 0 && thinStroke) {
    report(
      'warning',
      `has details narrower than the ${bit.name}'s ${bit.tipDiameter} mm tip, which come out softer. A bit with a sharper tip carves them crisply.`,
    );
  }
  if (deepest > thickness) {
    report('warning', `carves ${fmt(deepest)} deep, through the ${fmt(thickness)} stock.`);
  } else {
    const warnDepth = operation.warnDepth ?? defaultWarnDepth(thickness);
    if (deepest > warnDepth) {
      report(
        'warning',
        `carves up to ${fmt(deepest)} deep, more than the ${fmt(warnDepth)} you asked to be warned about. Wide parts carve deep; make them narrower, or use a V-bit with a wider angle (90° carves about 40% shallower than 60°).`,
      );
    }
  }

  return {
    plan: { kind: 'carve', chains: lines, levels: passDepths(deepest, feeds.depthPerPass) },
    // The carve stays inside the outlines.
    allPaths: paths,
    tabs: null,
    tabsHold: false,
    depth: deepest,
  };
}
