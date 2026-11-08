import type Konva from 'konva';
import { useRef, useState } from 'react';
import { Circle, Layer, Line, Rect } from 'react-konva';
import { distance, type Bounds, type Vec2 } from '../../core/geometry/path';
import { polylinePath } from '../../core/shapes/polyline';
import { canFinish, finishDrawing, placePoint } from '../../state/drawActions';
import { CURVE_SMOOTHING, useDrawStore } from '../../state/drawStore';
import type { CanvasColors } from './canvasColors';
import { snapCanvasPoint, type SnapGrid } from './snapping';

interface DrawingLayerProps {
  /** The part of the canvas on screen (mm), which the layer covers to catch clicks. */
  visible: Bounds;
  scale: number;
  snap: SnapGrid | null;
  colors: CanvasColors;
}

/** Clicking within this many screen px of the first point closes the shape. */
const CLOSE_PX = 10;
/** A press that moves further than this (px) is a pan, not a click. */
const CLICK_SLOP_PX = 4;
/** Points this close (screen px) count as the same click. */
const SAME_PX = 3;
const HANDLE_PX = 4;

/**
 * Sits above the shapes while the Line or Curve tool is on, so clicks place
 * points instead of picking shapes. Dragging still pans the canvas.
 */
export function DrawingLayer({ visible, scale, snap, colors }: DrawingLayerProps) {
  const tool = useDrawStore((s) => s.tool);
  const points = useDrawStore((s) => s.points);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const pressedAt = useRef<Vec2 | null>(null);
  /** Whether the latest click placed a point (rather than landing on the last one). */
  const clickAdded = useRef(false);
  const smoothing = tool === 'curve' ? CURVE_SMOOTHING : 0;

  const first = points[0];
  const nearFirst = (p: Vec2) =>
    first !== undefined && canFinish(true, points) && distance(p, first) * scale <= CLOSE_PX;

  const pointer = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const raw = e.target.getLayer()?.getRelativePointerPosition();
    return raw ? { raw, snapped: snapCanvasPoint(raw, snap, e.evt) } : null;
  };

  if (!tool) return null;

  const onClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    clickAdded.current = false;
    const start = pressedAt.current;
    const screen = e.target.getStage()?.getPointerPosition();
    if (start && screen && distance(start, screen) > CLICK_SLOP_PX) return;
    const at = pointer(e);
    if (!at) return;
    // With snapping on, the first point may sit up to half a grid cell from
    // where it was clicked, so landing on it counts too.
    if (nearFirst(at.raw) || nearFirst(at.snapped)) {
      finishDrawing(true);
      setHover(null);
      return;
    }
    clickAdded.current = placePoint(at.snapped, (a, b) => distance(a, b) * scale <= SAME_PX);
  };

  // Cheap enough to redo on every render: drawn lines have a handful of points.
  const closing = hover !== null && nearFirst(hover);
  const path = polylinePath({
    type: 'polyline',
    points: hover && !closing ? [...points, hover] : points,
    closed: closing,
    smoothing,
  });
  const r = HANDLE_PX / scale;
  return (
    <Layer>
      <Rect
        x={visible.minX}
        y={visible.minY}
        width={visible.maxX - visible.minX}
        height={visible.maxY - visible.minY}
        fill="transparent"
        onMouseDown={(e) => {
          pressedAt.current = e.target.getStage()?.getPointerPosition() ?? null;
        }}
        onMouseMove={(e) => setHover(pointer(e)?.snapped ?? null)}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        onDblClick={() => {
          // Konva reports any two quick clicks as a double-click, wherever they
          // land (after the second click's own handler). Only finish when that
          // second click landed on the point just placed; otherwise someone is
          // simply placing points quickly.
          if (clickAdded.current) return;
          finishDrawing(false);
          setHover(null);
        }}
      />
      <Line
        points={path.points.flatMap((p) => [p.x, p.y])}
        closed={closing}
        stroke={colors.pathSelected}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
      />
      {points.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={i === 0 && closing ? r * 2 : r}
          fill={i === 0 ? colors.pathSelected : colors.background}
          stroke={colors.pathSelected}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      {hover && !closing && (
        <Circle
          x={hover.x}
          y={hover.y}
          radius={r * 0.75}
          fill={colors.pathSelected}
          listening={false}
        />
      )}
    </Layer>
  );
}
