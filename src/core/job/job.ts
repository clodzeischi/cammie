import type { Path, Vec2 } from '../geometry/path';
import type { ObjectTransform } from '../geometry/transform';
import type { Feeds } from '../materials/materials';

/** Where machine X0 Y0 sits on the stock. Z0 is always the top of the material. */
export type OriginAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface Stock {
  width: number;
  height: number;
  thickness: number;
}

/**
 * Where the tool runs relative to the drawn line (SPEC.md §9.2):
 * - `on`: the tool centre follows the line (engraving; works on open paths).
 * - `outside`: the cut sits outside the shape, so the shape comes out at its
 *   drawn size (cutting a part out).
 * - `inside`: the cut sits inside the shape (cutting a hole of the drawn size).
 */
export type ProfileSide = 'on' | 'outside' | 'inside';

export interface ProfileOperation {
  type: 'profile';
  side: ProfileSide;
  bitId: string;
  depth: number;
  /** Values the user changed from the material preset. */
  overrides: Partial<Feeds>;
}

/** Later phases add pockets and V-carve. */
export type Operation = ProfileOperation;

export interface DesignObject {
  id: string;
  name: string;
  kind: 'traced-image' | 'svg';
  /** Outlines in the object's own mm space, with the bounding box starting at (0, 0). */
  paths: Path[];
  /** Natural (unscaled) size of `paths`. */
  width: number;
  height: number;
  transform: ObjectTransform;
  /** null = shown but not cut. */
  operation: Operation | null;
}

export interface Job {
  stock: Stock;
  origin: OriginAnchor;
  materialId: string;
  objects: DesignObject[];
}

/**
 * The anchor's position on the canvas. Canvas space is millimetres with the
 * stock's top-left corner at (0, 0) and Y pointing down.
 */
export function anchorPoint(stock: Stock, anchor: OriginAnchor): Vec2 {
  const [vertical, horizontal = vertical] = anchor.split('-') as [string, string?];
  const x = horizontal === 'left' ? 0 : horizontal === 'right' ? stock.width : stock.width / 2;
  const y = vertical === 'top' ? 0 : vertical === 'bottom' ? stock.height : stock.height / 2;
  return { x, y };
}

/** Canvas (Y down, stock top-left = 0,0) → machine (Y up, origin anchor = 0,0). */
export function canvasToMachine(p: Vec2, origin: Vec2): Vec2 {
  return { x: p.x - origin.x, y: origin.y - p.y };
}

export function machineToCanvas(p: Vec2, origin: Vec2): Vec2 {
  return { x: p.x + origin.x, y: origin.y - p.y };
}
