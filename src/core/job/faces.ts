import type { Vec2 } from '../geometry/path';
import {
  anchorPoint,
  canvasToMachine,
  machineToCanvas,
  type DesignObject,
  type Face,
  type FlipAxis,
  type Job,
  type Stock,
  type Toolpath,
} from './job';

export const faceOf = (toolpath: Pick<Toolpath, 'face'>): Face => toolpath.face ?? 'top';

/**
 * Where a point of the design lands once the stock is turned over: mirrored
 * across the stock's centre line. Mirroring twice gives the point back.
 */
export function flipPoint(p: Vec2, stock: Stock, flip: FlipAxis): Vec2 {
  return flip === 'left-right'
    ? { x: stock.width - p.x, y: p.y }
    : { x: p.x, y: stock.height - p.y };
}

/** The flip line on the canvas, as two end points on the stock's edges. */
export function flipLine(stock: Stock, flip: FlipAxis): [Vec2, Vec2] {
  return flip === 'left-right'
    ? [
        { x: stock.width / 2, y: 0 },
        { x: stock.width / 2, y: stock.height },
      ]
    : [
        { x: 0, y: stock.height / 2 },
        { x: stock.width, y: stock.height / 2 },
      ];
}

/** Distance from a canvas point to the flip line. */
export function distanceToFlipLine(p: Vec2, stock: Stock, flip: FlipAxis): number {
  return flip === 'left-right' ? Math.abs(p.x - stock.width / 2) : Math.abs(p.y - stock.height / 2);
}

/**
 * Converts between the design (canvas: Y down, as seen from the top) and the
 * machine for cuts on one face. Bottom cuts are mirrored, because the stock
 * is upside down when they run; the origin stays at the same corner of the
 * machine bed, which the flipped stock covers exactly.
 */
export interface CutFrame {
  face: Face;
  toMachine: (canvas: Vec2) => Vec2;
  toCanvas: (machine: Vec2) => Vec2;
}

export function cutFrame(job: Pick<Job, 'stock' | 'origin' | 'flip'>, face: Face): CutFrame {
  const origin = anchorPoint(job.stock, job.origin);
  if (face === 'top') {
    return {
      face,
      toMachine: (p) => canvasToMachine(p, origin),
      toCanvas: (p) => machineToCanvas(p, origin),
    };
  }
  const mirror = (p: Vec2) => flipPoint(p, job.stock, job.flip);
  return {
    face,
    toMachine: (p) => canvasToMachine(mirror(p), origin),
    toCanvas: (p) => mirror(machineToCanvas(p, origin)),
  };
}

/** How to describe turning the stock over, for the toolpath list and file headers. */
export const FLIP_LABEL: Record<FlipAxis, string> = {
  'left-right': 'left to right',
  'top-bottom': 'top to bottom',
};

/** Which side the user is working on: everything, or just one face's shapes and files. */
export type SideView = 'both' | Face;

/** A job is two-sided once anything is cut from the bottom or it has registration holes. */
export const isTwoSided = (job: Pick<Job, 'objects' | 'toolpaths'>): boolean =>
  job.toolpaths.some((t) => faceOf(t) === 'bottom') ||
  job.objects.some((o) => o.role === 'registration');

/**
 * Whether a shape shows while working on one side. Hidden: shapes cut only
 * from the other side. Always shown: registration holes (they belong to both
 * sides), shapes cut from both, and shapes with no cuts yet, so new work
 * never disappears.
 */
export function shownOnSide(
  object: Pick<DesignObject, 'id' | 'role'>,
  toolpaths: readonly Toolpath[],
  side: SideView,
): boolean {
  if (side === 'both' || object.role === 'registration') return true;
  const own = toolpaths.filter((t) => t.objectId === object.id);
  return own.length === 0 || own.some((t) => faceOf(t) === side);
}
