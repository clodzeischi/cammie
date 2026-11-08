import type { Vec2 } from '../core/geometry/path';
import { MIN_POINTS } from '../core/shapes/polyline';
import { createPolylineObject } from '../core/shapes/shapeObjects';
import { CURVE_SMOOTHING, useDrawStore, type DrawTool } from './drawStore';
import { useJobStore } from './jobStore';

const draw = () => useDrawStore.getState();

/** Starts drawing a line or curve; the current selection is dropped so it can't be moved by accident. */
export function startDrawing(tool: DrawTool) {
  useJobStore.getState().select(null);
  draw().start(tool);
}

/**
 * Adds a point unless it lands on the previous one (the second click of a
 * double-click, or a click on the same grid point). Returns whether it did.
 */
export function placePoint(p: Vec2, sameAs: (a: Vec2, b: Vec2) => boolean): boolean {
  const last = draw().points[draw().points.length - 1];
  if (last && sameAs(last, p)) return false;
  draw().addPoint(p);
  return true;
}

/** Can the drawing be finished now, open or closed? */
export function canFinish(closed: boolean, points = draw().points): boolean {
  return points.length >= (closed ? MIN_POINTS.closed : MIN_POINTS.open);
}

/**
 * Turns the placed points into a line or curve object and stops drawing.
 * With too few points it just stops. Returns whether an object was added.
 */
export function finishDrawing(closed: boolean): boolean {
  const { tool, points } = draw();
  draw().cancel();
  if (!tool || !canFinish(closed, points)) return false;
  const smoothing = tool === 'curve' ? CURVE_SMOOTHING : 0;
  const object = createPolylineObject(crypto.randomUUID(), points, closed, smoothing);
  useJobStore.getState().addObject(object);
  return true;
}

/** Starts moving the points of a line or curve (selecting it too). */
export function editPoints(id: string) {
  draw().cancel();
  useJobStore.getState().select(id);
  draw().setEditing(id);
}
