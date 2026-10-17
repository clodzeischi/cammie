import { boundsOfPoints, type Bounds, type Vec2 } from '../geometry/path';
import { applyMatrix, toMatrix, type ObjectTransform } from '../geometry/transform';
import type { DesignObject } from './job';

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

/**
 * Where the object's lower-left corner sits relative to the work origin, in
 * machine terms (X right, Y up). This is the "position" users type in.
 */
export function machinePosition(object: DesignObject, origin: Vec2): Vec2 {
  const b = objectBounds(object);
  return { x: b.minX - origin.x, y: origin.y - b.maxY };
}

/** Moves the object so its lower-left corner lands on `position`. */
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

/** The object's own size after scaling (ignores rotation). */
export const objectSize = (object: DesignObject) => ({
  width: object.width * object.transform.scaleX,
  height: object.height * object.transform.scaleY,
});

/**
 * Resizes the object. With `keepAspect`, the other dimension follows.
 * The lower-left corner stays put, which is what people expect when typing a size.
 */
export function withSize(
  object: DesignObject,
  origin: Vec2,
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
  const resized = { ...object, transform: { ...object.transform, scaleX, scaleY } };
  return withMachinePosition(resized, origin, machinePosition(object, origin));
}

/** Rotates about the object's centre so it doesn't swing across the stock. */
export function withRotation(object: DesignObject, rotation: number): ObjectTransform {
  const b = objectBounds(object);
  const centre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const rotated = { ...object, transform: { ...object.transform, rotation } };
  const rb = objectBounds(rotated);
  return {
    ...rotated.transform,
    x: rotated.transform.x + centre.x - (rb.minX + rb.maxX) / 2,
    y: rotated.transform.y + centre.y - (rb.minY + rb.maxY) / 2,
  };
}
