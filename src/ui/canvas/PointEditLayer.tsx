import type Konva from 'konva';
import { Circle, Layer, Line } from 'react-konva';
import type { Vec2 } from '../../core/geometry/path';
import { applyMatrix, invertMatrix, toMatrix } from '../../core/geometry/transform';
import type { DesignObject, PolylineShape } from '../../core/job/job';
import { MIN_POINTS } from '../../core/shapes/polyline';
import { withShape } from '../../core/shapes/shapeObjects';
import type { CanvasColors } from './canvasColors';
import { snapCanvasPoint, snapHandle, type SnapGrid } from './snapping';

interface PointEditLayerProps {
  object: DesignObject;
  shape: PolylineShape;
  scale: number;
  snap: SnapGrid | null;
  colors: CanvasColors;
  onChange: (object: DesignObject) => void;
}

const HANDLE_PX = 5;
/** How far (screen px) from the dashed line a double-click still adds a point. */
const HIT_PX = 10;

/** Index of the segment of `points` nearest `p`, and the nearest point on it. */
function nearestSegment(points: readonly Vec2[], closed: boolean, p: Vec2) {
  let best = { index: 0, at: points[0]!, distance: Infinity };
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
    const at = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < best.distance) best = { index: i, at, distance: d };
  }
  return best;
}

/**
 * Handles for moving a line's or curve's points, drawn over the shape. The
 * dashed line joins the points in order (a curve passes through them).
 */
export function PointEditLayer({
  object,
  shape,
  scale,
  snap,
  colors,
  onChange,
}: PointEditLayerProps) {
  const m = toMatrix(object.transform);
  const toLocal = invertMatrix(m);
  const onCanvas = shape.points.map((p) => applyMatrix(m, p));
  const minPoints = shape.closed ? MIN_POINTS.closed : MIN_POINTS.open;

  const setPoints = (canvasPoints: Vec2[]) =>
    onChange(
      withShape(object, { ...shape, points: canvasPoints.map((p) => applyMatrix(toLocal, p)) }),
    );

  const moveTo = (index: number, node: Konva.Node) =>
    setPoints(onCanvas.map((p, i) => (i === index ? { x: node.x(), y: node.y() } : p)));

  const insertAt = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pointer = e.target.getLayer()?.getRelativePointerPosition();
    if (!pointer) return;
    const { index, at } = nearestSegment(onCanvas, shape.closed, pointer);
    const point = snapCanvasPoint(at, snap, e.evt);
    setPoints([...onCanvas.slice(0, index + 1), point, ...onCanvas.slice(index + 1)]);
  };

  const r = HANDLE_PX / scale;
  return (
    <Layer>
      <Line
        points={onCanvas.flatMap((p) => [p.x, p.y])}
        closed={shape.closed}
        stroke={colors.pathSelected}
        strokeWidth={1}
        strokeScaleEnabled={false}
        dash={[4 / scale, 4 / scale]}
        hitStrokeWidth={HIT_PX}
        onDblClick={insertAt}
      />
      {onCanvas.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={r}
          fill={colors.background}
          stroke={colors.pathSelected}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          hitStrokeWidth={HIT_PX}
          draggable
          dragBoundFunc={function (this: Konva.Node, pos, evt) {
            return snapHandle(this, pos, snap, evt);
          }}
          onDragMove={(e) => moveTo(i, e.target)}
          onDblClick={() => {
            if (shape.points.length > minPoints) {
              setPoints(onCanvas.filter((_, j) => j !== i));
            }
          }}
          onMouseDown={(e) => {
            // Don't let the press reach the stage, which would pan or drop the selection.
            e.cancelBubble = true;
          }}
        />
      ))}
    </Layer>
  );
}
