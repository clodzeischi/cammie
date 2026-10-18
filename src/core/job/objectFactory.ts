import { boundsOfPaths, isEmptyBounds, type Path } from '../geometry/path';
import { DEFAULT_VBIT_ID } from '../tools/bits';
import type {
  DesignObject,
  Operation,
  PocketOperation,
  ProfileOperation,
  ProfileSide,
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
export type CutKind = ProfileSide | 'pocket';

export const cutKindOf = (op: Operation): CutKind => (op.type === 'pocket' ? 'pocket' : op.side);

/** Switches an operation's cut type, keeping bit, depth and the shared settings. */
export function withCutKind(op: Operation, kind: CutKind): Operation {
  const { bitId, depth, direction, entry, finishing } = op;
  const base = { bitId, depth, direction, entry, finishing };
  if (kind === 'pocket') return { ...base, type: 'pocket' } satisfies PocketOperation;
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
}

/**
 * Crops the paths to their bounding box (so X/Y and size refer to the actual
 * lines, not empty margins) and centres the object on the stock.
 */
export function createObject(input: NewObjectInput): DesignObject {
  const b = boundsOfPaths(input.paths);
  const ox = isEmptyBounds(b) ? 0 : b.minX;
  const oy = isEmptyBounds(b) ? 0 : b.minY;
  const width = isEmptyBounds(b) ? 0 : b.maxX - b.minX;
  const height = isEmptyBounds(b) ? 0 : b.maxY - b.minY;

  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    paths: input.paths.map((path) => ({
      closed: path.closed,
      points: path.points.map((p) => ({ x: p.x - ox, y: p.y - oy })),
    })),
    width,
    height,
    transform: {
      x: (input.stock.width - width) / 2,
      y: (input.stock.height - height) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    operation: defaultOperation(),
  };
}
