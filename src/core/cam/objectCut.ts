import { boundsOfPaths, type Bounds, type Path, type Vec2 } from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import { canvasToMachine, type DesignObject, type Job, type ProfileSide } from '../job/job';
import type { MachineConfig } from '../machine/machineConfig';
import type { Feeds, Material } from '../materials/materials';
import { findBit, grooveWidth, type Bit } from '../tools/bits';
import { profilePaths } from './profile';
import type { Diagnostic } from './program';
import { feedLabel, resolveFeeds } from './resolveFeeds';

/** Everything needed to cut one object, before ordering and pass generation. */
export interface ObjectCut {
  objectId: string;
  label: string;
  bit: Bit;
  /** Lower runs first within a file (SPEC.md §9.7). */
  priority: number;
  depth: number;
  feeds: Feeds;
  /** Tool-centre paths in machine coordinates. */
  paths: Path[];
  /** What the cut touches, in canvas coordinates (includes the tool's width). */
  cutBounds: Bounds;
}

export interface CutContext {
  job: Job;
  machine: MachineConfig;
  material: Material;
  bits: readonly Bit[];
  origin: Vec2;
}

type Report = (severity: Diagnostic['severity'], message: string) => void;

/** Holes and details first, then lines, then parts get cut free. */
const PRIORITY: Record<ProfileSide, number> = { inside: 2, on: 3, outside: 4 };

const SIDE_LABEL: Record<ProfileSide, string> = {
  on: 'On the line',
  outside: 'Outside',
  inside: 'Inside',
};

const fmt = (mm: number) => `${Math.round(mm * 100) / 100} mm`;

/**
 * Validates one object's operation and computes its tool-centre paths.
 * Returns null (after reporting why) when the object can't be cut.
 */
export function planObjectCut(
  object: DesignObject,
  ctx: CutContext,
  report: Report,
): ObjectCut | null {
  const { operation } = object;
  if (!operation) return null;

  const bit = findBit(operation.bitId, ctx.bits);
  if (!bit) return fail(report, 'its bit no longer exists. Pick another one.');
  if (!Number.isFinite(operation.depth) || operation.depth <= 0) {
    return fail(report, 'cut depth must be greater than 0.');
  }
  if (bit.type === 'vbit' && operation.side !== 'on') {
    return fail(
      report,
      'V-bits only cut on the line. Pick an end mill for inside or outside cuts.',
    );
  }

  const { feeds, clamped, invalid } = resolveFeeds(
    ctx.material,
    bit,
    operation.overrides,
    ctx.machine,
  );
  if (invalid.length > 0)
    return fail(report, `${invalid.map(feedLabel).join(', ')} must be greater than 0.`);
  clamped.forEach((note) => report('warning', note));
  if (bit.type === 'flat' && feeds.depthPerPass > bit.diameter / 2) {
    report(
      'warning',
      `depth per pass is more than half the bit's diameter, which risks breaking a ${bit.diameter} mm bit.`,
    );
  }

  const machinePaths = transformPaths(object.paths, object.transform).map((path) => ({
    closed: path.closed,
    points: path.points.map((p) => canvasToMachine(p, ctx.origin)),
  }));
  const sourcePaths = selectPaths(machinePaths, operation.side, report);
  if (!sourcePaths) return null;

  const profile = profilePaths(sourcePaths, operation.side, bit.diameter);
  if (profile.paths.length === 0) {
    return fail(report, `it's too small for the ${bit.name}, so nothing will be cut.`, 'warning');
  }
  if (profile.lostDetail) {
    report(
      'warning',
      `some details are narrower than the ${bit.name} and won't come out as drawn.`,
    );
  }

  checkDepth(operation.depth, operation.side, ctx.job.stock.thickness, report);

  return {
    objectId: object.id,
    label: `${SIDE_LABEL[operation.side]}: ${object.name}`,
    bit,
    priority: PRIORITY[operation.side],
    depth: operation.depth,
    feeds,
    paths: profile.paths,
    cutBounds: canvasCutBounds(profile.paths, grooveWidth(bit, operation.depth) / 2, ctx.origin),
  };
}

/** Through cuts may skim the spoilboard a little; anything more deserves a note. */
const SPOILBOARD_ALLOWANCE = 0.5;

function checkDepth(depth: number, side: ProfileSide, thickness: number, report: Report) {
  const extra = depth - thickness;
  const through = side !== 'on' && extra >= 0;
  if (extra > (through ? SPOILBOARD_ALLOWANCE : 0.01)) {
    report('warning', `cuts ${fmt(extra)} into the spoilboard.`);
  }
  if (through) {
    report(
      'warning',
      "cuts all the way through and tabs aren't available yet. Hold the part down with tape or clamps so it can't come loose.",
    );
  }
}

function fail(report: Report, message: string, severity: Diagnostic['severity'] = 'error'): null {
  report(severity, message);
  return null;
}

/** Inside/outside cuts need closed shapes; open lines are skipped with a note. */
function selectPaths(paths: Path[], side: ProfileSide, report: Report): Path[] | null {
  const nonEmpty = paths.filter((p) => p.points.length > 1);
  if (nonEmpty.length === 0)
    return fail(report, 'has no outlines, so nothing will be cut.', 'warning');
  if (side === 'on') return nonEmpty;

  const closed = nonEmpty.filter((p) => p.closed);
  if (closed.length === 0) {
    return fail(
      report,
      'has only open lines. Inside and outside cuts need closed shapes; use "On the line" instead.',
    );
  }
  if (closed.length < nonEmpty.length) {
    report(
      'warning',
      `${nonEmpty.length - closed.length} open line(s) skipped: inside and outside cuts need closed shapes.`,
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
