import { boundsOfPaths, isEmptyBounds, type Path } from '../geometry/path';
import { DEFAULT_VBIT_ID } from '../tools/bits';
import type { DesignObject, ProfileOperation, Stock } from './job';

/** New objects start as a shallow V-bit engrave: a fine line that's easy to deepen. */
export const DEFAULT_ENGRAVE_DEPTH = 0.5;

export const defaultOperation = (): ProfileOperation => ({
  type: 'profile',
  side: 'on',
  bitId: DEFAULT_VBIT_ID,
  depth: DEFAULT_ENGRAVE_DEPTH,
  overrides: {},
});

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
