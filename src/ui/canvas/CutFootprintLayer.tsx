import type Konva from 'konva';
import { memo, useMemo } from 'react';
import { Circle, Group, Layer, Line, Shape } from 'react-konva';
import { cutFootprint } from '../../core/cam/cutFootprint';
import type { Path } from '../../core/geometry/path';
import type { ObjectTransform } from '../../core/geometry/transform';
import type { DesignObject, Operation, Toolpath } from '../../core/job/job';
import { cutKindOf } from '../../core/job/objectFactory';
import { findBit, type Bit } from '../../core/tools/bits';
import { useDragPreviewStore } from '../../state/dragPreviewStore';
import type { CanvasColors } from './canvasColors';

interface CutFootprintLayerProps {
  objects: readonly DesignObject[];
  toolpaths: readonly Toolpath[];
  bits: readonly Bit[];
  colors: CanvasColors;
}

/** Light enough that the outlines and grid stay readable through it. */
const OPACITY = 0.35;

/**
 * Shows on the design what each cut removes (SPEC.md §9.11), in its cut
 * type's colour: a groove along the line, a band outside or inside it, or a
 * filled pocket. Follows shapes while they're dragged.
 */
export function CutFootprintLayer({ objects, toolpaths, bits, colors }: CutFootprintLayerProps) {
  const live = useDragPreviewStore((s) => s.transforms);
  const byId = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);
  return (
    <Layer listening={false} opacity={OPACITY}>
      {toolpaths.map((t) => {
        const object = byId.get(t.objectId);
        const bit = findBit(t.operation.bitId, bits);
        if (!object || !bit) return null;
        return (
          <Footprint
            key={t.id}
            object={object}
            transform={live?.[object.id] ?? object.transform}
            operation={t.operation}
            bit={bit}
            color={colors.cuts[cutKindOf(t.operation)]}
          />
        );
      })}
    </Layer>
  );
}

interface FootprintProps {
  object: DesignObject;
  transform: ObjectTransform;
  operation: Operation;
  bit: Bit;
  color: string;
}

/** Memoised: offsetting outlines is the slow part, and only needs redoing when the cut changes. */
const Footprint = memo(function Footprint({
  object,
  transform,
  operation,
  bit,
  color,
}: FootprintProps) {
  const scale = Math.sqrt(Math.abs(object.transform.scaleX * object.transform.scaleY));
  const { bands, area, holes } = useMemo(
    () => cutFootprint(object.paths, operation, bit, scale),
    [object.paths, operation, bit, scale],
  );
  return (
    <Group {...transform}>
      {area.length > 0 && <EvenOddFill paths={area} color={color} />}
      {bands.map(({ path, width }, i) => (
        <Line
          key={i}
          points={path.points.flatMap((p) => [p.x, p.y])}
          closed={path.closed}
          stroke={color}
          strokeWidth={width}
          lineJoin="round"
          lineCap="round"
          perfectDrawEnabled={false}
        />
      ))}
      {holes.map(({ centre, diameter }, i) => (
        <Circle key={i} x={centre.x} y={centre.y} radius={diameter / 2} fill={color} />
      ))}
    </Group>
  );
});

/** Fills outlines with the even-odd rule, so islands inside a pocket stay clear. */
function EvenOddFill({ paths, color }: { paths: Path[]; color: string }) {
  return (
    <Shape
      sceneFunc={(context: Konva.Context) => {
        const ctx = context._context;
        ctx.beginPath();
        for (const { points } of paths) {
          points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
        }
        ctx.fillStyle = color;
        ctx.fill('evenodd');
      }}
    />
  );
}
