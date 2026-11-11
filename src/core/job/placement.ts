import { boundsOfPoints, type Bounds, type Vec2 } from '../geometry/path';
import { applyMatrix, toMatrix, type ObjectTransform } from '../geometry/transform';
import { boxAnchor, type DesignObject, type OriginAnchor } from './job';

export const DEFAULT_PIVOT: OriginAnchor = 'bottom-left';

export const objectPivot = (object: DesignObject): OriginAnchor => object.pivot ?? DEFAULT_PIVOT;

/** Axis-aligned canvas bounds of the object's (possibly rotated) box. */
export function objectBounds(object: DesignObject): Bounds {
  const m = toMatrix(object.transform);
  const { width: w, height: h } = object;
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ].map((p) => applyMatrix(m, p));
  return boundsOfPoints(corners);
}

/** The object's pivot on the canvas: its anchor point on the axis-aligned bounds. */
export const pivotPoint = (object: DesignObject): Vec2 =>
  boxAnchor(objectBounds(object), objectPivot(object));

/**
 * Where the object's pivot (lower-left corner unless chosen otherwise) sits
 * relative to the work origin, in machine terms (X right, Y up). This is the
 * "position" users type in.
 */
export function machinePosition(object: DesignObject, origin: Vec2): Vec2 {
  const p = pivotPoint(object);
  return { x: p.x - origin.x, y: origin.y - p.y };
}

/** Moves the object so its pivot lands on `position`. */
export function withMachinePosition(
  object: DesignObject,
  origin: Vec2,
  position: Vec2,
): ObjectTransform {
  const current = machinePosition(object, origin);
  return {
    ...object.transform,
    x: object.transform.x + (position.x - current.x),
    // Machine Y up = canvas Y down.
    y: object.transform.y - (position.y - current.y),
  };
}

/** Shifts `changed` so its pivot is back where `before`'s was on the canvas. */
function keepingPivot(before: DesignObject, changed: ObjectTransform): ObjectTransform {
  const was = pivotPoint(before);
  const now = pivotPoint({ ...before, transform: changed });
  return { ...changed, x: changed.x + was.x - now.x, y: changed.y + was.y - now.y };
}

/** The object's own size after scaling (ignores rotation). */
export const objectSize = (object: DesignObject) => ({
  width: object.width * object.transform.scaleX,
  height: object.height * object.transform.scaleY,
});

/**
 * Resizes the object. With `keepAspect`, the other dimension follows.
 * The pivot stays put, which is what people expect when typing a size.
 */
export function withSize(
  object: DesignObject,
  size: { width?: number; height?: number },
  keepAspect: boolean,
): ObjectTransform {
  let { scaleX, scaleY } = object.transform;
  if (size.width !== undefined) {
    const next = size.width / object.width;
    if (keepAspect) scaleY *= next / scaleX;
    scaleX = next;
  } else if (size.height !== undefined) {
    const next = size.height / object.height;
    if (keepAspect) scaleX *= next / scaleY;
    scaleY = next;
  }
  return keepingPivot(object, { ...object.transform, scaleX, scaleY });
}

/**
 * Rotates the object, then shifts it so its pivot hasn't moved: the typed
 * X/Y stays true, and a centre pivot spins it in place.
 */
export function withRotation(object: DesignObject, rotation: number): ObjectTransform {
  return keepingPivot(object, { ...object.transform, rotation });
}
