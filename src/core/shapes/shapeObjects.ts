import type { Path, Vec2 } from '../geometry/path';
import { applyMatrix, toMatrix } from '../geometry/transform';
import type { DesignObject, EllipseShape, RectShape, Stock } from '../job/job';
import { createObject, cropToBounds } from '../job/objectFactory';
import { ellipsePath, rectPath } from './primitives';

export type BasicShape = RectShape | EllipseShape;

export const DEFAULT_RECT: RectShape = { type: 'rect', width: 60, height: 40, cornerRadius: 0 };
export const DEFAULT_ELLIPSE: EllipseShape = { type: 'ellipse', width: 40, height: 40 };

export const isBasicShape = (shape: DesignObject['shape']): shape is BasicShape =>
  shape?.type === 'rect' || shape?.type === 'ellipse';

export function shapePaths(shape: BasicShape): Path[] {
  return [
    shape.type === 'rect'
      ? rectPath(shape.width, shape.height, shape.cornerRadius)
      : ellipsePath(shape.width, shape.height),
  ];
}

const shapeName = (shape: BasicShape) =>
  shape.type === 'rect' ? 'Rectangle' : shape.width === shape.height ? 'Circle' : 'Ellipse';

/** A rectangle or ellipse, centred on the stock. */
export function createShapeObject(id: string, shape: BasicShape, stock: Stock): DesignObject {
  return createObject({
    id,
    name: shapeName(shape),
    kind: shape.type,
    shape,
    paths: shapePaths(shape),
    stock,
  });
}

/**
 * Rectangles and ellipses keep scale 1 and store their real size instead, so
 * a stretched rectangle keeps round corners rather than squashed ones.
 * Exact: the transform scales before rotating, so building the geometry at the
 * scaled size and dropping the scale lands every point in the same place.
 */
export function withBakedScale(object: DesignObject): DesignObject {
  const { shape, transform } = object;
  if (!isBasicShape(shape) || (transform.scaleX === 1 && transform.scaleY === 1)) return object;
  const resized: BasicShape = {
    ...shape,
    width: shape.width * Math.abs(transform.scaleX),
    height: shape.height * Math.abs(transform.scaleY),
  };
  return {
    ...object,
    name: object.name === shapeName(shape) ? shapeName(resized) : object.name,
    shape: resized,
    paths: shapePaths(resized),
    width: resized.width,
    height: resized.height,
    transform: { ...transform, scaleX: 1, scaleY: 1 },
  };
}

/** Changes a rectangle's or ellipse's parameters, keeping its top-left corner in place. */
export function withShape(object: DesignObject, shape: BasicShape): DesignObject {
  return withGeometry({ ...object, shape }, shapePaths(shape), { x: 0, y: 0 });
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
