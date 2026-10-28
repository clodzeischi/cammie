import { boundsOfPaths, boundsOfPoints, type Bounds, type Path } from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import { cantCutReason, canCut } from '../job/bitCapabilities';
import { faceOf, type CutFrame } from '../job/faces';
import type { DesignObject, Job, Operation } from '../job/job';
import { cutKindOf, type CutKind } from '../job/objectFactory';
import type { MachineConfig } from '../machine/machineConfig';
import { overridesFor, type FeedOverrides } from '../materials/feedOverrides';
import type { Material } from '../materials/materials';
import { findBit, grooveWidth, type Bit } from '../tools/bits';
import { planChamfer } from './chamferPlan';
import type { ObjectCut, PlanResult } from './cutPlan';
import { planDrill } from './drillPlan';
import { planPocket } from './pocketPlan';
import { planProfile, type ProfilePlanInput } from './profilePlan';
import type { Diagnostic } from './program';
import { feedLabel, resolveFeeds } from './resolveFeeds';

export interface CutContext {
  job: Job;
  machine: MachineConfig;
  material: Material;
  bits: readonly Bit[];
  feedOverrides: FeedOverrides;
  /** Canvas ↔ machine for the face this toolpath is cut from. */
  frame: CutFrame;
}

type Report = (severity: Diagnostic['severity'], message: string) => void;

const LABEL: Record<CutKind, string> = {
  drill: 'Drill',
  pocket: 'Pocket',
  inside: 'Inside',
  on: 'On the line',
  chamfer: 'Chamfer',
  outside: 'Outside',
};

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
  const kind = cutKindOf(operation);

  const bit = findBit(operation.bitId, ctx.bits);
  if (!bit) return fail(report, 'its bit no longer exists. Pick another one.');
  if (!Number.isFinite(operation.depth) || operation.depth <= 0) {
    return fail(report, 'cut depth must be greater than 0.');
  }
  if (!canCut(bit, kind)) return fail(report, cantCutReason(bit, kind));

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
    points: path.points.map(ctx.frame.toMachine),
  }));
  const paths = selectPaths(machinePaths, kind === 'on', report);
  if (!paths) return null;

  const { thickness } = ctx.job.stock;
  const planned = planFor(
    { object, operation, bit, feeds, paths, thickness, frame: ctx.frame },
    report,
  );
  if (!planned) return null;

  // Registration holes go into the spoilboard on purpose, so the pins have something to sit in.
  if (object.role !== 'registration') {
    // On the top of a two-sided job a loose part is lost before its bottom is cut.
    const flippedLater =
      ctx.frame.face === 'top' && ctx.job.toolpaths.some((t) => faceOf(t) === 'bottom');
    checkDepth(operation.depth, kind, thickness, planned.tabsHold, flippedLater, report);
  }

  return {
    toolpathId,
    objectId: object.id,
    face: ctx.frame.face,
    label: `${LABEL[kind]}: ${object.name}`,
    bit,
    depth: operation.depth,
    feeds,
    plan: planned.plan,
    cutBounds: canvasCutBounds(planned.allPaths, grooveWidth(bit, operation.depth) / 2, ctx.frame),
    tabs: planned.tabs,
  };
}

type PlanInput = Omit<ProfilePlanInput, 'operation'> & { operation: Operation };

/** Hands the cut to the planner for its type. The bit has already been checked against the cut. */
function planFor(input: PlanInput, report: Report): PlanResult | null {
  const { operation, bit, feeds, paths } = input;
  switch (operation.type) {
    case 'pocket':
      return planPocket(operation, bit, feeds, paths, report);
    case 'drill':
      return planDrill(operation, bit, feeds, paths, report);
    case 'chamfer':
      return bit.type === 'vbit' ? planChamfer(operation, bit, feeds, paths, report) : null;
    case 'profile':
      return planProfile({ ...input, operation }, report);
  }
}

/** Through cuts may skim the spoilboard a little; anything more deserves a note. */
const SPOILBOARD_ALLOWANCE = 0.5;

function checkDepth(
  depth: number,
  kind: CutKind,
  thickness: number,
  tabsHold: boolean,
  flippedLater: boolean,
  report: Report,
) {
  const extra = depth - thickness;
  const through = kind !== 'on' && kind !== 'chamfer' && extra >= 0;
  if (extra > (through ? SPOILBOARD_ALLOWANCE : 0.01)) {
    report('warning', `cuts ${fmt(extra)} into the spoilboard.`);
  }
  if (through && (kind === 'outside' || kind === 'inside') && !tabsHold) {
    if (flippedLater) {
      report(
        'warning',
        'cuts all the way through on the top with no tabs, so the part comes loose before the stock is turned over. Add tabs, or cut it out from the bottom.',
      );
      return;
    }
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

/** Tool-path bounds converted back to canvas space, grown by the cut's half-width. */
function canvasCutBounds(paths: Path[], halfWidth: number, frame: CutFrame): Bounds {
  const b = boundsOfPaths(paths);
  const corners = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.maxY },
  ].map(frame.toCanvas);
  const c = boundsOfPoints(corners);
  return {
    minX: c.minX - halfWidth,
    maxX: c.maxX + halfWidth,
    minY: c.minY - halfWidth,
    maxY: c.maxY + halfWidth,
  };
}
