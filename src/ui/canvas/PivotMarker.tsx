import { Circle, Layer, Line } from 'react-konva';
import type { DesignObject } from '../../core/job/job';
import { pivotPoint } from '../../core/job/placement';
import { useDragPreviewStore } from '../../state/dragPreviewStore';
import type { CanvasColors } from './canvasColors';

interface PivotMarkerProps {
  object: DesignObject;
  scale: number;
  colors: CanvasColors;
}

/** Screen size of the marker (px), whatever the zoom. */
const RADIUS_PX = 4;
const ARM_PX = 8;

/** A small crosshair on the selected shape's pivot, following it while it's dragged. */
export function PivotMarker({ object, scale, colors }: PivotMarkerProps) {
  const live = useDragPreviewStore((s) => s.transforms?.[object.id]);
  const p = pivotPoint(live ? { ...object, transform: live } : object);
  const r = RADIUS_PX / scale;
  const arm = ARM_PX / scale;
  const stroke = { stroke: colors.pathSelected, strokeWidth: 1.5, strokeScaleEnabled: false };

  return (
    <Layer listening={false}>
      <Circle x={p.x} y={p.y} radius={r} fill={colors.background} {...stroke} />
      <Line points={[p.x - arm, p.y, p.x + arm, p.y]} {...stroke} />
      <Line points={[p.x, p.y - arm, p.x, p.y + arm]} {...stroke} />
    </Layer>
  );
}
