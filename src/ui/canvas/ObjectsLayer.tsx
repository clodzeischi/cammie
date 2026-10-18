import type Konva from 'konva';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Group, Layer, Line, Rect, Transformer } from 'react-konva';
import type { ObjectTransform } from '../../core/geometry/transform';
import type { DesignObject } from '../../core/job/job';
import type { CanvasColors } from './canvasColors';

interface ObjectsLayerProps {
  objects: DesignObject[];
  selectedId: string | null;
  /** False in preview: objects are faded and can't be moved. */
  interactive: boolean;
  colors: CanvasColors;
  onSelect: (id: string) => void;
  onTransform: (id: string, transform: ObjectTransform) => void;
}

const readTransform = (node: Konva.Node): ObjectTransform => ({
  x: node.x(),
  y: node.y(),
  rotation: node.rotation(),
  scaleX: node.scaleX(),
  scaleY: node.scaleY(),
});

/** Smallest size (screen px) the resize handles will shrink an object to. */
const MIN_BOX_PX = 4;

export function ObjectsLayer(props: ObjectsLayerProps) {
  const { objects, selectedId, interactive, colors, onSelect, onTransform } = props;
  const nodes = useRef(new Map<string, Konva.Group>());
  const transformer = useRef<Konva.Transformer>(null);
  const register = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const node = selectedId && interactive ? nodes.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, interactive, objects]);

  return (
    // Remount when switching modes: Konva doesn't rebuild a layer's hit areas when
    // `listening` flips back on, which left objects unclickable after a preview.
    <Layer
      key={interactive ? 'edit' : 'view'}
      opacity={interactive ? 1 : 0.35}
      listening={interactive}
    >
      {objects.map((object) => (
        <ObjectNode
          key={object.id}
          object={object}
          color={object.id === selectedId ? colors.pathSelected : colors.path}
          interactive={interactive}
          register={register}
          onSelect={onSelect}
          onTransform={onTransform}
        />
      ))}
      <Transformer
        ref={transformer}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        keepRatio
        flipEnabled={false}
        enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
        anchorStroke={colors.pathSelected}
        borderStroke={colors.pathSelected}
        boundBoxFunc={(oldBox, newBox) =>
          Math.abs(newBox.width) < MIN_BOX_PX || Math.abs(newBox.height) < MIN_BOX_PX
            ? oldBox
            : newBox
        }
      />
    </Layer>
  );
}

interface ObjectNodeProps {
  object: DesignObject;
  color: string;
  interactive: boolean;
  register: (id: string, node: Konva.Group | null) => void;
  onSelect: (id: string) => void;
  onTransform: (id: string, transform: ObjectTransform) => void;
}

/**
 * Memoised (callbacks take the id, so they stay stable): re-drawing thousands
 * of points for every object on each render would be slow.
 */
const ObjectNode = memo(function ObjectNode(props: ObjectNodeProps) {
  const { object, color, interactive, register, onSelect, onTransform } = props;
  const { id } = object;
  const ref = useCallback((node: Konva.Group | null) => register(id, node), [register, id]);
  const select = () => onSelect(id);
  const flat = useMemo(
    () => object.paths.map((path) => path.points.flatMap((p) => [p.x, p.y])),
    [object.paths],
  );

  return (
    <Group
      ref={ref}
      {...object.transform}
      draggable={interactive}
      onMouseDown={select}
      onTap={select}
      onDragStart={select}
      onDragEnd={(e) => onTransform(id, readTransform(e.target))}
      onTransformEnd={(e) => onTransform(id, readTransform(e.target))}
    >
      {/* Invisible box so the whole object is grabbable, not just its thin lines. */}
      <Rect width={object.width} height={object.height} fill="transparent" />
      {flat.map((points, i) => (
        <Line
          key={i}
          points={points}
          closed={object.paths[i]!.closed}
          stroke={color}
          strokeWidth={1.25}
          strokeScaleEnabled={false}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
});
