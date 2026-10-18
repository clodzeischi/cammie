import type Konva from 'konva';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Group, Layer, Line, Rect, Transformer } from 'react-konva';
import type { ObjectTransform } from '../../core/geometry/transform';
import type { DesignObject } from '../../core/job/job';
import { isBasicShape } from '../../core/shapes/shapeObjects';
import type { SelectMode } from '../../state/jobStore';
import type { CanvasColors } from './canvasColors';

interface ObjectsLayerProps {
  objects: DesignObject[];
  selectedIds: string[];
  /** False in preview: objects are faded and can't be moved. */
  interactive: boolean;
  colors: CanvasColors;
  onSelect: (id: string, mode: SelectMode) => void;
  onTransform: (transforms: Record<string, ObjectTransform>) => void;
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

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const CORNERS_AND_SIDES = [
  ...CORNERS,
  'top-center',
  'bottom-center',
  'middle-left',
  'middle-right',
];

export function ObjectsLayer(props: ObjectsLayerProps) {
  const { objects, selectedIds, interactive, colors, onSelect, onTransform } = props;
  const nodes = useRef(new Map<string, Konva.Group>());
  const transformer = useRef<Konva.Transformer>(null);
  const register = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const selected = interactive ? selectedIds.map((id) => nodes.current.get(id)) : [];
    tr.nodes(selected.filter((n): n is Konva.Group => n !== undefined));
    tr.getLayer()?.batchDraw();
  }, [selectedIds, interactive, objects]);

  /** Reports where the dragged object, and everything moving with it, ended up. */
  const reportMoved = useCallback(
    (id: string) => {
      const attached = transformer.current?.nodes() ?? [];
      const moved = attached.some((n) => n.id() === id) ? attached : [nodes.current.get(id)];
      const transforms: Record<string, ObjectTransform> = {};
      for (const node of moved) if (node) transforms[node.id()] = readTransform(node);
      onTransform(transforms);
    },
    [onTransform],
  );

  // A lone rectangle or ellipse can be stretched freely; anything else keeps its proportions.
  const only = selectedIds.length === 1 ? objects.find((o) => o.id === selectedIds[0]) : undefined;
  const freeResize = isBasicShape(only?.shape);

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
          color={selectedIds.includes(object.id) ? colors.pathSelected : colors.path}
          interactive={interactive}
          register={register}
          onSelect={onSelect}
          onMoved={reportMoved}
        />
      ))}
      <Transformer
        ref={transformer}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        keepRatio={!freeResize}
        flipEnabled={false}
        enabledAnchors={freeResize ? CORNERS_AND_SIDES : CORNERS}
        onTransformEnd={(e) => {
          const transforms: Record<string, ObjectTransform> = {};
          for (const node of (e.currentTarget as Konva.Transformer).nodes()) {
            transforms[node.id()] = readTransform(node);
          }
          onTransform(transforms);
        }}
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
  onSelect: (id: string, mode: SelectMode) => void;
  onMoved: (id: string) => void;
}

/**
 * Memoised (callbacks take the id, so they stay stable): re-drawing thousands
 * of points for every object on each render would be slow.
 */
const ObjectNode = memo(function ObjectNode(props: ObjectNodeProps) {
  const { object, color, interactive, register, onSelect, onMoved } = props;
  const { id, transform } = object;
  const node = useRef<Konva.Group | null>(null);
  const ref = useCallback(
    (n: Konva.Group | null) => {
      node.current = n;
      register(id, n);
    },
    [register, id],
  );
  // react-konva only re-applies props that changed since the last render, but
  // dragging and the transformer move the node directly. Without this, a
  // stretched rectangle (whose scale goes back to 1 once its real size is
  // stored) would keep the transformer's scale on screen.
  useLayoutEffect(() => {
    node.current?.setAttrs(transform);
  }, [transform]);
  const press = (e: Konva.KonvaEventObject<MouseEvent>) =>
    onSelect(id, e.evt.shiftKey ? 'toggle' : 'keep');
  const flat = useMemo(
    () => object.paths.map((path) => path.points.flatMap((p) => [p.x, p.y])),
    [object.paths],
  );

  return (
    <Group
      ref={ref}
      id={id}
      {...transform}
      draggable={interactive}
      onMouseDown={press}
      // A click that didn't drag picks just this object out of a selection.
      onClick={(e) => !e.evt.shiftKey && onSelect(id, 'replace')}
      onTap={() => onSelect(id, 'replace')}
      onDragEnd={() => onMoved(id)}
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
