import type Konva from 'konva';
import type { Vec2 } from '../../core/geometry/path';
import { snapBoxOffset, snapPoint } from '../../core/job/grid';

/** Grid to snap to, in canvas mm; null when snapping is off. */
export interface SnapGrid {
  origin: Vec2;
  spacing: number;
}

/** Holding Alt (Option on a Mac) while dragging places freely. */
const bypass = (evt: unknown) => evt instanceof MouseEvent && evt.altKey;

/**
 * Konva dragBoundFunc body: given the absolute position Konva is about to
 * give a dragged object, nudges it so the object's box has an edge on the grid.
 */
export function snapDrag(node: Konva.Node, pos: Vec2, grid: SnapGrid | null, evt: unknown): Vec2 {
  const layer = node.getLayer();
  if (!grid || !layer || bypass(evt)) return pos;
  const toScreen = layer.getAbsoluteTransform();
  const proposed = toScreen.copy().invert().point(pos);
  const box = node.getClientRect({ relativeTo: layer, skipStroke: true });
  const dx = proposed.x - node.x();
  const dy = proposed.y - node.y();
  const d = snapBoxOffset(
    {
      minX: box.x + dx,
      minY: box.y + dy,
      maxX: box.x + box.width + dx,
      maxY: box.y + box.height + dy,
    },
    grid.origin,
    grid.spacing,
  );
  return toScreen.point({ x: proposed.x + d.x, y: proposed.y + d.y });
}

/** Konva anchorDragBoundFunc body: resize handles land on grid points (rotation is left alone). */
export function snapAnchor(
  transformer: Konva.Transformer,
  pos: Vec2,
  grid: SnapGrid | null,
  evt: unknown,
): Vec2 {
  const layer = transformer.getLayer();
  if (!grid || !layer || bypass(evt) || transformer.getActiveAnchor() === 'rotater') return pos;
  const toScreen = layer.getAbsoluteTransform();
  const canvas = toScreen.copy().invert().point(pos);
  return toScreen.point(snapPoint(canvas, grid.origin, grid.spacing));
}
