import { boundsOfPaths, isEmptyBounds, type Path } from '../geometry/path';
import { DEFAULT_VBIT_ID } from '../tools/bits';
import type {
  ChamferOperation,
  DesignObject,
  DrillOperation,
  Operation,
  PocketOperation,
  ProfileOperation,
  ProfileSide,
  ShapeParams,
  Stock,
  TabSettings,
} from './job';

/** New objects start as a shallow V-bit engrave: a fine line that's easy to deepen. */
export const DEFAULT_ENGRAVE_DEPTH = 0.5;
/** Finishing passes take this much (mm) off the walls by default. */
export const DEFAULT_ALLOWANCE = 0.2;

export const defaultTabs = (): TabSettings => ({
  enabled: true,
  count: null,
  width: null,
  height: 1.5,
  manual: null,
});

export const defaultOperation = (): ProfileOperation => ({
  type: 'profile',
  side: 'on',
  bitId: DEFAULT_VBIT_ID,
  depth: DEFAULT_ENGRAVE_DEPTH,
  direction: 'climb',
  entry: 'ramp',
  finishing: { enabled: false, allowance: DEFAULT_ALLOWANCE },
  tabs: defaultTabs(),
});

/** The choices in the "Cut type" menu. */
export type CutKind = ProfileSide | 'pocket' | 'chamfer' | 'drill';

export const cutKindOf = (op: Operation): CutKind => (op.type === 'profile' ? op.side : op.type);

/** How far past the stock a "cut through" goes, to clean up the bottom edge. */
export const THROUGH_EXTRA = 0.2;
/** Pockets start this deep (mm), or the stock thickness if that's less. */
export const DEFAULT_POCKET_DEPTH = 2;
/** Chamfers start this deep: a 1 mm bevel with a 90° bit. */
export const DEFAULT_CHAMFER_DEPTH = 1;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The depth a new cut of this kind starts at: lines are shallow, cut-outs go through. */
export function defaultDepth(kind: CutKind, thickness: number): number {
  if (kind === 'on') return DEFAULT_ENGRAVE_DEPTH;
  if (kind === 'chamfer') return DEFAULT_CHAMFER_DEPTH;
  if (kind === 'pocket') return Math.min(DEFAULT_POCKET_DEPTH, thickness);
  return round2(thickness + THROUGH_EXTRA);
}

/** A new cut of the given kind with its usual depth. */
export function newOperation(kind: CutKind, bitId: string, thickness: number): Operation {
  return withCutKind({ ...defaultOperation(), bitId, depth: defaultDepth(kind, thickness) }, kind);
}

/** Switches an operation's cut type, keeping bit, depth and the shared settings. */
export function withCutKind(op: Operation, kind: CutKind): Operation {
  const { bitId, depth, direction, entry, finishing } = op;
  const base = { bitId, depth, direction, entry, finishing };
  if (kind === 'pocket') return { ...base, type: 'pocket' } satisfies PocketOperation;
  if (kind === 'drill') return { ...base, type: 'drill' } satisfies DrillOperation;
  if (kind === 'chamfer') {
    // A hole's rim when it was cut as a hole; otherwise the shape's own edge.
    const side = op.type === 'profile' && op.side === 'inside' ? 'inside' : 'outside';
    return { ...base, type: 'chamfer', side } satisfies ChamferOperation;
  }
  const tabs = op.type === 'profile' ? op.tabs : defaultTabs();
  return { ...base, type: 'profile', side: kind, tabs } satisfies ProfileOperation;
}

export interface NewObjectInput {
  id: string;
  name: string;
  kind: DesignObject['kind'];
  /** Outlines in mm, anywhere in space. */
  paths: Path[];
  stock: Stock;
  shape?: ShapeParams;
}

/** Moves paths so their bounding box starts at (0, 0); returns the box size too. */
export function cropToBounds(paths: readonly Path[]): {
  paths: Path[];
  width: number;
  height: number;
} {
  const b = boundsOfPaths(paths);
  const empty = isEmptyBounds(b);
  const ox = empty ? 0 : b.minX;
  const oy = empty ? 0 : b.minY;
  return {
    paths: paths.map((path) => ({
      closed: path.closed,
      points: path.points.map((p) => ({ x: p.x - ox, y: p.y - oy })),
    })),
    width: empty ? 0 : b.maxX - b.minX,
    height: empty ? 0 : b.maxY - b.minY,
  };
}

/**
 * Crops the paths to their bounding box (so X/Y and size refer to the actual
 * lines, not empty margins) and centres the object on the stock.
 */
export function createObject(input: NewObjectInput): DesignObject {
  const { paths, width, height } = cropToBounds(input.paths);
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    ...(input.shape && { shape: input.shape }),
    paths,
    width,
    height,
    transform: {
      x: (input.stock.width - width) / 2,
      y: (input.stock.height - height) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
  };
}
