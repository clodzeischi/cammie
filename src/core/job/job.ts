import type { Path, Vec2 } from '../geometry/path';
import type { ObjectTransform } from '../geometry/transform';

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

/** With a clockwise (M3) spindle, climb keeps the finished wall on the right of travel. */
export type CutDirection = 'climb' | 'conventional';

/** How the tool gets down to each new depth: straight down, or easing in at a shallow angle. */
export type EntryStyle = 'ramp' | 'plunge';

export interface FinishingPass {
  enabled: boolean;
  /** Material left on the walls by the roughing passes, taken off by the finishing pass (mm). */
  allowance: number;
}

/** Small bridges that hold a cut-out part in place (SPEC.md §9.3). */
export interface TabSettings {
  enabled: boolean;
  /** Tabs per loop; null = based on the loop's length. */
  count: number | null;
  /** Length of tool path lifted over each tab (mm); null = 4 mm + bit diameter. */
  width: number | null;
  /** Measured up from the bottom of the stock (mm). */
  height: number;
  /** Hand-placed tab centres in the object's own space; null = automatic. */
  manual: Vec2[] | null;
}

interface CutBase {
  bitId: string;
  depth: number;
  direction: CutDirection;
  entry: EntryStyle;
  finishing: FinishingPass;
}

export interface ProfileOperation extends CutBase {
  type: 'profile';
  side: ProfileSide;
  tabs: TabSettings;
}

/** Clears all the material inside closed shapes, leaving islands standing (SPEC.md §9.4). */
export interface PocketOperation extends CutBase {
  type: 'pocket';
}

/** Later phases add V-carve. */
export type Operation = ProfileOperation | PocketOperation;

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
