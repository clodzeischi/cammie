import type Konva from 'konva';
import { useRef } from 'react';
import { Stage } from 'react-konva';
import type { ObjectTabs } from '../../core/cam/program';
import { editTabsAt } from '../../core/job/tabEditing';
import { useJobStore } from '../../state/jobStore';
import { useCanvasColors } from './canvasColors';
import { ObjectsLayer } from './ObjectsLayer';
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
  const updateObject = useJobStore((s) => s.updateObject);
  const { view, setView, fit } = useViewport(stock, size);

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (pointer) setView(zoomAt(view, pointer, Math.exp(-e.evt.deltaY * WHEEL_ZOOM)));
  };

  const isStage = (e: Konva.KonvaEventObject<unknown>) => e.target === e.target.getStage();
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  /** In preview, clicking near a cut-out's toolpath adds or removes a tab. */
  const onPreviewClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pointer = e.target.getStage()?.getPointerPosition();
    const start = pressedAt.current;
    if (!preview || !pointer || !start) return;
    if (Math.hypot(pointer.x - start.x, pointer.y - start.y) > CLICK_SLOP_PX) return;
    const world = { x: (pointer.x - view.x) / view.scale, y: (pointer.y - view.y) / view.scale };
    const edit = editTabsAt(world, preview.tabs, objects, TAB_CLICK_PX / view.scale);
    const object = edit && objects.find((o) => o.id === edit.objectId);
    if (!edit || object?.operation?.type !== 'profile') return;
    const op = object.operation;
    updateObject(object.id, { operation: { ...op, tabs: { ...op.tabs, manual: edit.manual } } });
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
        >
          <StockLayer stock={stock} origin={origin} scale={view.scale} colors={colors} />
          <ObjectsLayer
            objects={objects}
            selectedIds={selectedIds}
            interactive={!preview}
            colors={colors}
            onSelect={select}
            onTransform={setTransforms}
          />
          {preview && <ToolpathLayer {...preview} scale={view.scale} colors={colors} />}
          {preview && <TabMarkers tabs={preview.tabs} scale={view.scale} colors={colors} />}
        </Stage>
      )}
      <div className="canvas-zoom">
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
