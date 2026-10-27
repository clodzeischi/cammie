import { boundsOfPaths, type Bounds, type Path, type Vec2 } from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import { cantCutReason, canCut } from '../job/bitCapabilities';
import { canvasToMachine, type DesignObject, type Job, type Operation } from '../job/job';
import { CUT_PRIORITY } from '../job/toolpaths';
import type { MachineConfig } from '../machine/machineConfig';
import { overridesFor, type FeedOverrides } from '../materials/feedOverrides';
import type { Material } from '../materials/materials';
import { findBit, grooveWidth, type Bit } from '../tools/bits';
import type { ObjectCut } from './cutPlan';
import { planPocket } from './pocketPlan';
import { planProfile } from './profilePlan';
import type { Diagnostic } from './program';
import { feedLabel, resolveFeeds } from './resolveFeeds';

export interface CutContext {
  job: Job;
  machine: MachineConfig;
  material: Material;
  bits: readonly Bit[];
  feedOverrides: FeedOverrides;
  origin: Vec2;
}

type Report = (severity: Diagnostic['severity'], message: string) => void;

const LABEL = {
  pocket: 'Pocket',
  inside: 'Inside',
  on: 'On the line',
  outside: 'Outside',
} as const;

const kindOf = (op: Operation) => (op.type === 'pocket' ? 'pocket' : op.side);

const fmt = (mm: number) => `${Math.round(mm * 100) / 100} mm`;

/**
 * Validates one toolpath and plans its cut on `object`.
 * Returns null (after reporting why) when it can't be cut.
 */
export function planObjectCut(
  toolpathId: string,
  object: DesignObject,
  operation: Operation,
  ctx: CutContext,
  report: Report,
): ObjectCut | null {
  const kind = kindOf(operation);

  const bit = findBit(operation.bitId, ctx.bits);
  if (!bit) return fail(report, 'its bit no longer exists. Pick another one.');
  if (!Number.isFinite(operation.depth) || operation.depth <= 0) {
    return fail(report, 'cut depth must be greater than 0.');
  }
  if (!canCut(bit, kind)) return fail(report, cantCutReason(bit));

  const overrides = overridesFor(ctx.feedOverrides, ctx.material.id, bit.id);
  const { feeds, clamped, invalid } = resolveFeeds(ctx.material, bit, overrides, ctx.machine);
  if (invalid.length > 0) {
    return fail(report, `${invalid.map(feedLabel).join(', ')} must be greater than 0.`);
  }
  clamped.forEach((note) => report('warning', note));
  if (bit.type !== 'vbit' && feeds.depthPerPass > bit.diameter / 2) {
    report(
      'warning',
      `depth per pass is more than half the bit's diameter, which risks breaking a ${bit.diameter} mm bit.`,
    );
  }

  const machinePaths = transformPaths(object.paths, object.transform).map((path) => ({
    closed: path.closed,
    points: path.points.map((p) => canvasToMachine(p, ctx.origin)),
  }));
  const paths = selectPaths(machinePaths, kind === 'on', report);
  if (!paths) return null;

  const { thickness } = ctx.job.stock;
  const planned =
    operation.type === 'pocket'
      ? planPocket(operation, bit, feeds, paths, report)
      : planProfile(
          { object, operation, bit, feeds, paths, thickness, origin: ctx.origin },
          report,
        );
  if (!planned) return null;

  checkDepth(operation.depth, kind, thickness, planned.tabsHold, report);

  return {
    toolpathId,
    objectId: object.id,
    label: `${LABEL[kind]}: ${object.name}`,
    bit,
    depth: operation.depth,
    feeds,
    plan: planned.plan,
    cutBounds: canvasCutBounds(planned.allPaths, grooveWidth(bit, operation.depth) / 2, ctx.origin),
    tabs: planned.tabs,
  };
}

/** Through cuts may skim the spoilboard a little; anything more deserves a note. */
const SPOILBOARD_ALLOWANCE = 0.5;

function checkDepth(
  depth: number,
  kind: keyof typeof CUT_PRIORITY,
  thickness: number,
  tabsHold: boolean,
  report: Report,
) {
  const extra = depth - thickness;
  const through = kind !== 'on' && extra >= 0;
  if (extra > (through ? SPOILBOARD_ALLOWANCE : 0.01)) {
    report('warning', `cuts ${fmt(extra)} into the spoilboard.`);
  }
  if (through && (kind === 'outside' || kind === 'inside') && !tabsHold) {
    report(
      'warning',
      "cuts all the way through with no tabs. Hold the part down with tape or clamps so it can't come loose.",
    );
  }
}

function fail(report: Report, message: string, severity: Diagnostic['severity'] = 'error'): null {
  report(severity, message);
  return null;
}

/** Everything but "on the line" needs closed shapes; open lines are skipped with a note. */
function selectPaths(paths: Path[], allowOpen: boolean, report: Report): Path[] | null {
  const nonEmpty = paths.filter((p) => p.points.length > 1);
  if (nonEmpty.length === 0)
    return fail(report, 'has no outlines, so nothing will be cut.', 'warning');
  if (allowOpen) return nonEmpty;

  const closed = nonEmpty.filter((p) => p.closed);
  if (closed.length === 0) {
    return fail(
      report,
      'has only open lines. This cut needs closed shapes; use "On the line" instead.',
    );
  }
  if (closed.length < nonEmpty.length) {
    report(
      'warning',
      `${nonEmpty.length - closed.length} open line(s) skipped: this cut needs closed shapes.`,
    );
  }
  return closed;
}

/** Tool-path bounds grown by the cut's half-width, converted back to canvas space. */
function canvasCutBounds(paths: Path[], halfWidth: number, origin: Vec2): Bounds {
  const b = boundsOfPaths(paths);
  return {
    minX: b.minX - halfWidth + origin.x,
    maxX: b.maxX + halfWidth + origin.x,
    minY: origin.y - b.maxY - halfWidth,
    maxY: origin.y - b.minY + halfWidth,
  };
}
