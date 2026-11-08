import { boundsOfPaths, isEmptyBounds, type Path, type Vec2 } from '../geometry/path';
import { applyMatrix, toMatrix } from '../geometry/transform';
import type {
  CogShape,
  DesignObject,
  EllipseShape,
  PolygonShape,
  RectShape,
  ShapeParams,
  StarShape,
  Stock,
  TextShape,
} from '../job/job';
import { createObject, cropToBounds } from '../job/objectFactory';
import { polylinePath } from './polyline';
import { ellipsePath, rectPath } from './primitives';
import { cogPaths, polygonPath, starPath } from './regularShapes';

/** Shapes drawn in the app other than text: rebuilt from their parameters at their real size. */
export type DrawnShape = Exclude<ShapeParams, TextShape>;

export const DEFAULT_RECT: RectShape = { type: 'rect', width: 60, height: 40, cornerRadius: 0 };
export const DEFAULT_ELLIPSE: EllipseShape = { type: 'ellipse', width: 40, height: 40 };
export const DEFAULT_POLYGON: PolygonShape = { type: 'polygon', width: 40, height: 40, sides: 6 };
export const DEFAULT_STAR: StarShape = {
  type: 'star',
  width: 40,
  height: 40,
  points: 5,
  innerRatio: 0.45,
};
export const DEFAULT_COG: CogShape = {
  type: 'cog',
  width: 50,
  height: 50,
  teeth: 12,
  toothDepth: 4,
  toothWidth: 0.5,
  boreDiameter: 8,
};

export const isDrawnShape = (shape: DesignObject['shape']): shape is DrawnShape =>
  shape !== undefined && shape.type !== 'text';

/** The shape's outlines in its own space (not yet cropped to their box). */
export function shapePaths(shape: DrawnShape): Path[] {
  switch (shape.type) {
    case 'rect':
      return [rectPath(shape.width, shape.height, shape.cornerRadius)];
    case 'ellipse':
      return [ellipsePath(shape.width, shape.height)];
    case 'polygon':
      return [polygonPath(shape)];
    case 'star':
      return [starPath(shape)];
    case 'cog':
      return cogPaths(shape);
    case 'polyline':
      return [polylinePath(shape)];
  }
}

export function shapeName(shape: DrawnShape): string {
  switch (shape.type) {
    case 'rect':
      return 'Rectangle';
    case 'ellipse':
      return shape.width === shape.height ? 'Circle' : 'Ellipse';
    case 'polygon':
      return 'Polygon';
    case 'star':
      return 'Star';
    case 'cog':
      return 'Cog';
    case 'polyline':
      return shape.smoothing > 0 ? 'Curve' : 'Line';
  }
}

/** The shape stretched by sx × sy, as parameters (so nothing is distorted). */
function scaledShape(shape: DrawnShape, sx: number, sy: number): DrawnShape {
  if (shape.type === 'polyline') {
    return { ...shape, points: shape.points.map((p) => ({ x: p.x * sx, y: p.y * sy })) };
  }
  const resized = { ...shape, width: shape.width * sx, height: shape.height * sy };
  if (resized.type !== 'cog') return resized;
  // Cog sizes are measured before the squash to `height`, so they follow the width.
  return {
    ...resized,
    toothDepth: resized.toothDepth * sx,
    boreDiameter: resized.boreDiameter * sx,
  };
}

interface BuiltShape {
  shape: DrawnShape;
  paths: Path[];
  width: number;
  height: number;
  /** Where the outlines' box started before cropping it to (0, 0). */
  offset: Vec2;
}

/**
 * Outlines cropped to their box. A polyline's points move with them, so they
 * stay on the outline in the object's own space.
 */
function buildShape(shape: DrawnShape): BuiltShape {
  const raw = shapePaths(shape);
  const b = boundsOfPaths(raw);
  const offset = isEmptyBounds(b) ? { x: 0, y: 0 } : { x: b.minX, y: b.minY };
  const { paths, width, height } = cropToBounds(raw);
  const shifted: DrawnShape =
    shape.type === 'polyline'
      ? { ...shape, points: shape.points.map((p) => ({ x: p.x - offset.x, y: p.y - offset.y })) }
      : shape;
  return { shape: shifted, paths, width, height, offset };
}

/** Where the object's own (0, 0) sits in its shape's uncropped space. */
const cropOffset = (shape: DrawnShape): Vec2 =>
  shape.type === 'polyline' ? { x: 0, y: 0 } : buildShape(shape).offset;

/** A drawn shape centred on the stock. */
export function createShapeObject(id: string, shape: DrawnShape, stock: Stock): DesignObject {
  const built = buildShape(shape);
  return createObject({
    id,
    name: shapeName(built.shape),
    kind: shape.type,
    shape: built.shape,
    paths: built.paths,
    stock,
  });
}

/** A line or curve from points placed on the canvas; it stays where it was drawn. */
export function createPolylineObject(
  id: string,
  canvasPoints: readonly Vec2[],
  closed: boolean,
  smoothing: number,
): DesignObject {
  const built = buildShape({ type: 'polyline', points: [...canvasPoints], closed, smoothing });
  return {
    id,
    name: shapeName(built.shape),
    kind: 'polyline',
    shape: built.shape,
    paths: built.paths,
    width: built.width,
    height: built.height,
    transform: { x: built.offset.x, y: built.offset.y, rotation: 0, scaleX: 1, scaleY: 1 },
  };
}

/**
 * Drawn shapes keep scale 1 and store their real size instead, so a stretched
 * rectangle keeps round corners rather than squashed ones. Exact: the
 * transform scales before rotating, and every shape's outline scales with its
 * parameters, so building it at the new size and dropping the scale lands
 * every point in the same place.
 */
export function withBakedScale(object: DesignObject): DesignObject {
  const { shape, transform } = object;
  if (!isDrawnShape(shape) || (transform.scaleX === 1 && transform.scaleY === 1)) return object;
  const built = buildShape(
    scaledShape(shape, Math.abs(transform.scaleX), Math.abs(transform.scaleY)),
  );
  return {
    ...object,
    name: object.name === shapeName(shape) ? shapeName(built.shape) : object.name,
    shape: built.shape,
    paths: built.paths,
    width: built.width,
    height: built.height,
    transform: { ...transform, scaleX: 1, scaleY: 1 },
  };
}

/**
 * Changes a drawn shape's parameters without moving what stays the same: a
 * rectangle keeps its top-left corner, a polygon its centre, and a line the
 * points that weren't moved. Rotation is kept.
 */
export function withShape(object: DesignObject, shape: DrawnShape): DesignObject {
  const before = isDrawnShape(object.shape) ? cropOffset(object.shape) : { x: 0, y: 0 };
  const built = buildShape(shape);
  const shift = { x: built.offset.x - before.x, y: built.offset.y - before.y };
  // The box's corner moved by `shift` in the object's own space; move the object to match.
  const m = toMatrix(object.transform);
  const d = applyMatrix({ ...m, e: 0, f: 0 }, shift);
  const renamed = isDrawnShape(object.shape) && object.name === shapeName(object.shape);
  return {
    ...object,
    name: renamed ? shapeName(built.shape) : object.name,
    shape: built.shape,
    paths: built.paths,
    width: built.width,
    height: built.height,
    transform: { ...object.transform, x: object.transform.x + d.x, y: object.transform.y + d.y },
  };
}

/**
 * Replaces an object's outlines (anywhere in space; they are cropped to their
 * box) without moving it on the stock: the point at fraction `anchor` of the
 * box (0,0 = top-left, 1,0 = top-right) stays where it was. Rotation and
 * scale are kept.
 */
export function withGeometry(object: DesignObject, rawPaths: readonly Path[], anchor: Vec2) {
  const { paths, width, height } = cropToBounds(rawPaths);
  const m = toMatrix(object.transform);
  const before = applyMatrix(m, { x: anchor.x * object.width, y: anchor.y * object.height });
  const local = { x: anchor.x * width, y: anchor.y * height };
  // Translation is the only part of the matrix that changes.
  const offset = applyMatrix({ ...m, e: 0, f: 0 }, local);
  return {
    ...object,
    paths,
    width,
    height,
    transform: { ...object.transform, x: before.x - offset.x, y: before.y - offset.y },
  };
}
