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

/**
 * Bevels the edges of a closed shape with a V-bit (SPEC.md §9.8). `outside`
 * bevels the shape's own edges (a part); `inside` bevels the rim of a hole of
 * this shape. `depth` sets the width: width = depth × tan(half the bit's angle).
 * The finishing pass doesn't apply.
 */
export interface ChamferOperation extends CutBase {
  type: 'chamfer';
  side: 'outside' | 'inside';
}

/**
 * Drills one hole the size of the bit at the centre of each closed shape,
 * pecking down by the depth per pass (SPEC.md §9.9). Direction, entry and the
 * finishing pass don't apply; they're kept so switching cut types loses nothing.
 */
export interface DrillOperation extends CutBase {
  type: 'drill';
}

/**
 * Carves inside closed shapes with a V-bit along their centre lines, deeper
 * where they're wider, so walls slope and corners come out sharp (SPEC.md
 * §9.5). The depth follows from the shape and the bit; `depth` is unused but
 * kept so switching cut types loses nothing.
 */
export interface VCarveOperation extends CutBase {
  type: 'vcarve';
  /** Warn when the carve goes deeper than this (mm); null = half the stock's thickness. */
  warnDepth: number | null;
}

export type Operation =
  ProfileOperation | PocketOperation | ChamferOperation | DrillOperation | VCarveOperation;

export type TextAlign = 'left' | 'center' | 'right';

/** Text drawn in the app (SPEC.md §6.1). Sizes are before the object's scale. */
export interface TextShape {
  type: 'text';
  text: string;
  fontId: string;
  /** Height of a capital letter (mm). */
  capHeight: number;
  /** Extra space between letters (mm); may be negative. */
  letterSpacing: number;
  /** Multiple of the font's normal line height. */
  lineSpacing: number;
  align: TextAlign;
}

export interface RectShape {
  type: 'rect';
  width: number;
  height: number;
  cornerRadius: number;
}

export interface EllipseShape {
  type: 'ellipse';
  width: number;
  height: number;
}

/**
 * Regular shapes are drawn inside a `width` × `height` box: a circle of that
 * diameter, stretched when the two differ. Their outline may not fill the box
 * (a triangle doesn't reach its sides), so the object's size can be smaller.
 */
export interface PolygonShape {
  type: 'polygon';
  width: number;
  height: number;
  sides: number;
}

export interface StarShape {
  type: 'star';
  width: number;
  height: number;
  points: number;
  /** Inner corners' distance from the centre, as a fraction of the outer (0–1). */
  innerRatio: number;
}

export interface CogShape {
  type: 'cog';
  width: number;
  height: number;
  teeth: number;
  /** Tip to root (mm, before stretching). */
  toothDepth: number;
  /** Share of each tooth's spacing taken by the tooth at its root (0–1). */
  toothWidth: number;
  /** Centre hole (mm); 0 = none. */
  boreDiameter: number;
}

/**
 * Lines and curves drawn point by point. `points` are in the object's own
 * space, like its paths. `smoothing` 0 gives straight segments; 1 gives a
 * smooth curve through every point.
 */
export interface PolylineShape {
  type: 'polyline';
  points: Vec2[];
  closed: boolean;
  smoothing: number;
}

/** Parameters of objects drawn in the app; their paths are rebuilt from these. */
export type ShapeParams =
  TextShape | RectShape | EllipseShape | PolygonShape | StarShape | CogShape | PolylineShape;

export interface DesignObject {
  id: string;
  name: string;
  kind: 'traced-image' | 'svg' | ShapeParams['type'];
  /** Present for text and shapes (SPEC.md §6). */
  shape?: ShapeParams;
  /** Objects sharing a group id are selected and arranged together. */
  groupId?: string;
  /** Outlines in the object's own mm space, with the bounding box starting at (0, 0). */
  paths: Path[];
  /** Natural (unscaled) size of `paths`. */
  width: number;
  height: number;
  transform: ObjectTransform;
}

/**
 * One cut on one object. Objects without toolpaths are shown but not cut, and
 * an object can have several (e.g. a pocket and then a cut-out). Toolpaths
 * using the same bit share a file (see groupIntoFiles for the file order), and
 * toolpaths run in list order within a file.
 */
export interface Toolpath {
  id: string;
  objectId: string;
  operation: Operation;
}

export interface Job {
  stock: Stock;
  origin: OriginAnchor;
  materialId: string;
  objects: DesignObject[];
  toolpaths: Toolpath[];
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

/** Converts between the design (canvas: Y down) and the machine (Y up, origin at the anchor). */
export interface CutFrame {
  toMachine: (canvas: Vec2) => Vec2;
  toCanvas: (machine: Vec2) => Vec2;
}

export function cutFrame(job: Pick<Job, 'stock' | 'origin'>): CutFrame {
  const origin = anchorPoint(job.stock, job.origin);
  return {
    toMachine: (p) => canvasToMachine(p, origin),
    toCanvas: (p) => machineToCanvas(p, origin),
  };
}
