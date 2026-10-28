import type Konva from 'konva';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Group, Layer, Line, Rect, Transformer } from 'react-konva';
import type { ObjectTransform } from '../../core/geometry/transform';
import type { DesignObject } from '../../core/job/job';
import { isBasicShape } from '../../core/shapes/shapeObjects';
import type { SelectMode } from '../../state/jobStore';
import type { CanvasColors } from './canvasColors';
import { snapAnchor, snapDrag, type SnapGrid } from './snapping';

interface ObjectsLayerProps {
  objects: DesignObject[];
  selectedIds: string[];
  /** False in preview: objects are faded and can't be moved. */
  interactive: boolean;
  colors: CanvasColors;
  onSelect: (id: string, mode: SelectMode) => void;
  onTransform: (transforms: Record<string, ObjectTransform>) => void;
  /** Positions while dragging, resizing or rotating (null once it's released). */
  onLiveTransform?: (transforms: Record<string, ObjectTransform> | null) => void;
  snap: SnapGrid | null;
}

const readTransform = (node: Konva.Node): ObjectTransform => ({
  x: node.x(),
  y: node.y(),
  rotation: node.rotation(),
  scaleX: node.scaleX(),
  scaleY: node.scaleY(),
});

/** How far (screen px) from a line a click still picks its object. */
const HIT_SLACK_PX = 10;

/** Size on the stock, for stacking click areas (rotation doesn't change it). */
const area = (o: DesignObject) =>
  Math.abs(o.width * o.transform.scaleX * o.height * o.transform.scaleY);

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
  const {
    objects,
    selectedIds,
    interactive,
    colors,
    onSelect,
    onTransform,
    onLiveTransform,
    snap,
  } = props;
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

  /** Where the dragged object, and everything moving with it, is now. */
  const movedWith = useCallback((id: string) => {
    const attached = transformer.current?.nodes() ?? [];
    const moved = attached.some((n) => n.id() === id) ? attached : [nodes.current.get(id)];
    const transforms: Record<string, ObjectTransform> = {};
    for (const node of moved) if (node) transforms[node.id()] = readTransform(node);
    return transforms;
  }, []);
  const reportMoving = useCallback(
    (id: string) => onLiveTransform?.(movedWith(id)),
    [movedWith, onLiveTransform],
  );
  const reportMoved = useCallback(
    (id: string) => {
      onTransform(movedWith(id));
      onLiveTransform?.(null);
    },
    [movedWith, onTransform, onLiveTransform],
  );
  const transformed = (tr: Konva.Transformer) => {
    const transforms: Record<string, ObjectTransform> = {};
    for (const node of tr.nodes()) transforms[node.id()] = readTransform(node);
    return transforms;
  };

  // A lone rectangle or ellipse can be stretched freely; anything else keeps its proportions.
  const only = selectedIds.length === 1 ? objects.find((o) => o.id === selectedIds[0]) : undefined;
  const freeResize = isBasicShape(only?.shape);
  // Outlines have no fill, so drawing order doesn't show. Stack click areas by
  // size instead, smallest on top: a shape inside a bigger one is always
  // clickable, and the bigger one still is everywhere else.
  const stacked = useMemo(() => [...objects].sort((a, b) => area(b) - area(a)), [objects]);

  return (
    // Remount when switching modes: Konva doesn't rebuild a layer's hit areas when
    // `listening` flips back on, which left objects unclickable after a preview.
    <Layer
      key={interactive ? 'edit' : 'view'}
      opacity={interactive ? 1 : 0.35}
      listening={interactive}
    >
      {stacked.map((object) => (
        <ObjectNode
          key={object.id}
          object={object}
          color={selectedIds.includes(object.id) ? colors.pathSelected : colors.path}
          interactive={interactive}
          register={register}
          onSelect={onSelect}
          onMoving={reportMoving}
          onMoved={reportMoved}
          snap={snap}
        />
      ))}
      <Transformer
        ref={transformer}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        keepRatio={!freeResize}
        // Measure objects without their outline's stroke, so sizes stay exact.
        ignoreStroke
        flipEnabled={false}
        enabledAnchors={freeResize ? CORNERS_AND_SIDES : CORNERS}
        anchorDragBoundFunc={(_old, pos, evt) =>
          transformer.current ? snapAnchor(transformer.current, pos, snap, evt) : pos
        }
        onTransform={(e) => onLiveTransform?.(transformed(e.currentTarget as Konva.Transformer))}
        onTransformEnd={(e) => {
          onTransform(transformed(e.currentTarget as Konva.Transformer));
          onLiveTransform?.(null);
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
  onMoving: (id: string) => void;
  onMoved: (id: string) => void;
  snap: SnapGrid | null;
}

/**
 * Memoised (callbacks take the id, so they stay stable): re-drawing thousands
 * of points for every object on each render would be slow.
 */
const ObjectNode = memo(function ObjectNode(props: ObjectNodeProps) {
  const { object, color, interactive, register, onSelect, onMoving, onMoved, snap } = props;
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
      dragBoundFunc={(pos, evt) => (node.current ? snapDrag(node.current, pos, snap, evt) : pos)}
      onMouseDown={press}
      // A click that didn't drag picks just this object out of a selection.
      onClick={(e) => !e.evt.shiftKey && onSelect(id, 'replace')}
      onTap={() => onSelect(id, 'replace')}
      onDragMove={() => onMoving(id)}
      onDragEnd={() => onMoved(id)}
    >
      {/* Text is grabbed anywhere in its box; picking out thin letters would be fiddly. */}
      {object.kind === 'text' && (
        <Rect width={object.width} height={object.height} fill="transparent" />
      )}
      {/* Everything else is picked by its lines (with some slack) or the inside of a
          closed outline, so a click on empty space reaches the shape behind. */}
      {flat.map((points, i) => (
        <Line
          key={i}
          points={points}
          closed={object.paths[i]!.closed}
          fill={object.paths[i]!.closed ? 'transparent' : undefined}
          stroke={color}
          strokeWidth={1.25}
          strokeScaleEnabled={false}
          hitStrokeWidth={HIT_SLACK_PX}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
});
