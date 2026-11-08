import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import type { ObjectTabs } from '../../core/cam/program';
import { anchorPoint } from '../../core/job/job';
import { editTabsAt } from '../../core/job/tabEditing';
import { useGridStore } from '../../state/gridStore';
import type { ObjectTransform } from '../../core/geometry/transform';
import { editPoints } from '../../state/drawActions';
import { useDrawStore } from '../../state/drawStore';
import { useDragPreviewStore } from '../../state/dragPreviewStore';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { useCanvasColors } from './canvasColors';
import { DrawingLayer } from './DrawingLayer';
import { GridControls } from './GridControls';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CutFootprintLayer } from './CutFootprintLayer';
import { ObjectsLayer } from './ObjectsLayer';
import { PointEditLayer } from './PointEditLayer';
import type { SnapGrid } from './snapping';
import { StockLayer } from './StockLayer';
import { TabMarkers } from './TabMarkers';
import { ToolpathLayer } from './ToolpathLayer';
import type { ProgramPreview } from './toolpathRuns';
import { useElementSize } from './useElementSize';
import { useViewport, zoomAt } from './viewport';

export interface PreviewState {
  previews: ProgramPreview[];
  activeIndex: number;
  done: number;
  showCutWidth: boolean;
  tabs: ObjectTabs[];
}

interface DesignCanvasProps {
  /** Present in preview mode. */
  preview: PreviewState | null;
}

/** Zoom speed for mouse wheels and trackpad pinches. */
const WHEEL_ZOOM = 0.0015;
/** How close (screen px) a click must be to a toolpath or tab to edit tabs. */
const TAB_CLICK_PX = 10;
/** A press that moves further than this (px) is a pan, not a click. */
const CLICK_SLOP_PX = 4;

export function DesignCanvas({ preview }: DesignCanvasProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const colors = useCanvasColors();
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const objects = useJobStore((s) => s.objects);
  const selectedIds = useJobStore((s) => s.selectedIds);
  const select = useJobStore((s) => s.select);
  const setTransforms = useJobStore((s) => s.setTransforms);
  const setLiveTransforms = useCallback(
    (t: Record<string, ObjectTransform> | null) =>
      t ? useDragPreviewStore.getState().set(t) : useDragPreviewStore.getState().clear(),
    [],
  );
  const toolpaths = useJobStore((s) => s.toolpaths);
  const updateToolpath = useJobStore((s) => s.updateToolpath);
  const { view, setView, fit } = useViewport(stock, size);
  const gridSpacing = useGridStore((s) => s.spacing);
  const snapOn = useGridStore((s) => s.snap);
  const showCuts = useGridStore((s) => s.showCuts);
  const bits = useToolingStore((s) => s.bits);
  const snap = useMemo<SnapGrid | null>(
    () => (snapOn ? { origin: anchorPoint(stock, origin), spacing: gridSpacing } : null),
    [snapOn, stock, origin, gridSpacing],
  );
  const drawing = useDrawStore((s) => s.tool !== null);
  const editingId = useDrawStore((s) => s.editingId);
  const setEditing = useDrawStore((s) => s.setEditing);
  const updateObject = useJobStore((s) => s.updateObject);
  const editing = objects.find((o) => o.id === editingId && o.shape?.type === 'polyline');
  // Point editing ends when its shape is no longer the one selected (or is gone).
  useEffect(() => {
    if (editingId && (!editing || !selectedIds.includes(editingId) || preview)) setEditing(null);
  }, [editingId, editing, selectedIds, preview, setEditing]);
  const visible = {
    minX: -view.x / view.scale,
    minY: -view.y / view.scale,
    maxX: (size.width - view.x) / view.scale,
    maxY: (size.height - view.y) / view.scale,
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (pointer) setView(zoomAt(view, pointer, Math.exp(-e.evt.deltaY * WHEEL_ZOOM)));
  };

  const isStage = (e: Konva.KonvaEventObject<unknown>) => e.target === e.target.getStage();
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  /** Right-click: picks the shape under the pointer (keeping a selection it's part of), then opens the menu. */
  const onContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (preview || useDrawStore.getState().tool) return;
    const ids = new Set(objects.map((o) => o.id));
    let node: Konva.Node | null = e.target;
    while (node && !ids.has(node.id())) node = node.getParent();
    if (node) select(node.id(), 'keep');
    else select(null);
    setMenuAt({ x: e.evt.clientX, y: e.evt.clientY });
  };
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  /** In preview, clicking near a cut-out's toolpath adds or removes a tab. */
  const onPreviewClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pointer = e.target.getStage()?.getPointerPosition();
    const start = pressedAt.current;
    if (!preview || !pointer || !start) return;
    if (Math.hypot(pointer.x - start.x, pointer.y - start.y) > CLICK_SLOP_PX) return;
    const world = { x: (pointer.x - view.x) / view.scale, y: (pointer.y - view.y) / view.scale };
    const edit = editTabsAt(world, preview.tabs, objects, TAB_CLICK_PX / view.scale);
    const op = edit && toolpaths.find((t) => t.id === edit.toolpathId)?.operation;
    if (!edit || op?.type !== 'profile') return;
    updateToolpath(edit.toolpathId, { ...op, tabs: { ...op.tabs, manual: edit.manual } });
  };
  const zoomCentre = (factor: number) =>
    setView(zoomAt(view, { x: size.width / 2, y: size.height / 2 }, factor));

  return (
    <div ref={containerRef} className="canvas-container">
      {size.width > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          onDragMove={(e) => isStage(e) && setView({ ...view, x: e.target.x(), y: e.target.y() })}
          onWheel={onWheel}
          onMouseDown={(e) => {
            pressedAt.current = e.target.getStage()?.getPointerPosition() ?? null;
            if (isStage(e)) select(null);
          }}
          onClick={onPreviewClick}
          onTap={(e) => isStage(e) && select(null)}
          onContextMenu={onContextMenu}
        >
          <StockLayer
            stock={stock}
            origin={origin}
            scale={view.scale}
            gridSpacing={gridSpacing}
            colors={colors}
          />
          {!preview && showCuts && (
            <CutFootprintLayer
              objects={objects}
              toolpaths={toolpaths}
              bits={bits}
              colors={colors}
            />
          )}
          <ObjectsLayer
            objects={objects}
            selectedIds={selectedIds}
            interactive={!preview}
            colors={colors}
            onSelect={select}
            onTransform={setTransforms}
            onLiveTransform={setLiveTransforms}
            snap={snap}
            editingId={editingId}
            onEditPoints={editPoints}
          />
          {!preview && editing?.shape?.type === 'polyline' && (
            <PointEditLayer
              object={editing}
              shape={editing.shape}
              scale={view.scale}
              snap={snap}
              colors={colors}
              onChange={({ name, shape, paths, width, height, transform }) =>
                updateObject(editing.id, { name, shape, paths, width, height, transform })
              }
            />
          )}
          {!preview && drawing && (
            <DrawingLayer visible={visible} scale={view.scale} snap={snap} colors={colors} />
          )}
          {preview && <ToolpathLayer {...preview} scale={view.scale} colors={colors} />}
          {preview && <TabMarkers tabs={preview.tabs} scale={view.scale} colors={colors} />}
        </Stage>
      )}
      {menuAt && <CanvasContextMenu {...menuAt} onClose={() => setMenuAt(null)} />}
      {drawing && !preview && (
        <p className="canvas-hint" role="status">
          Click to place points. Click the first point to close the shape; double-click or press
          Enter to finish an open line. Backspace takes back a point, Esc cancels.
        </p>
      )}
      <div className="canvas-zoom">
        {!preview && <GridControls />}
        <button
          type="button"
          className="icon-button"
          aria-label="Zoom in"
          onClick={() => zoomCentre(1.25)}
        >
          +
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Zoom out"
          onClick={() => zoomCentre(0.8)}
        >
          −
        </button>
        <button type="button" className="button button-small" onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  );
}
