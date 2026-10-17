import type Konva from 'konva';
import { useCallback } from 'react';
import { Stage } from 'react-konva';
import type { ObjectTransform } from '../../core/geometry/transform';
import { useJobStore } from '../../state/jobStore';
import { useCanvasColors } from './canvasColors';
import { ObjectsLayer } from './ObjectsLayer';
import { StockLayer } from './StockLayer';
import { ToolpathLayer } from './ToolpathLayer';
import type { ProgramPreview } from './toolpathRuns';
import { useElementSize } from './useElementSize';
import { useViewport, zoomAt } from './viewport';

export interface PreviewState {
  previews: ProgramPreview[];
  activeIndex: number;
  done: number;
  showCutWidth: boolean;
}

interface DesignCanvasProps {
  /** Present in preview mode. */
  preview: PreviewState | null;
}

/** Zoom speed for mouse wheels and trackpad pinches. */
const WHEEL_ZOOM = 0.0015;

export function DesignCanvas({ preview }: DesignCanvasProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const colors = useCanvasColors();
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const objects = useJobStore((s) => s.objects);
  const selectedId = useJobStore((s) => s.selectedId);
  const select = useJobStore((s) => s.select);
  const updateObject = useJobStore((s) => s.updateObject);
  const { view, setView, fit } = useViewport(stock, size);

  const onTransform = useCallback(
    (id: string, transform: ObjectTransform) => updateObject(id, { transform }),
    [updateObject],
  );

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (pointer) setView(zoomAt(view, pointer, Math.exp(-e.evt.deltaY * WHEEL_ZOOM)));
  };

  const isStage = (e: Konva.KonvaEventObject<unknown>) => e.target === e.target.getStage();
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
          onMouseDown={(e) => isStage(e) && select(null)}
          onTap={(e) => isStage(e) && select(null)}
        >
          <StockLayer stock={stock} origin={origin} scale={view.scale} colors={colors} />
          <ObjectsLayer
            objects={objects}
            selectedId={selectedId}
            interactive={!preview}
            colors={colors}
            onSelect={select}
            onTransform={onTransform}
          />
          {preview && <ToolpathLayer {...preview} scale={view.scale} colors={colors} />}
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
