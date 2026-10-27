import type { Vec2 } from '../geometry/path';
import {
  anchorPoint,
  canvasToMachine,
  machineToCanvas,
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
