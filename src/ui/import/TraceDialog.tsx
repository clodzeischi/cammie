import { useEffect, useRef, useState } from 'react';
import type { DesignObject, Stock } from '../../core/job/job';
import { artworkSize, createTracedObject, suggestedWidth } from '../../core/job/tracedObject';
import { otsuThreshold } from '../../core/trace/grayBitmap';
import {
  DEFAULT_TRACE_OPTIONS,
  type TraceOptions,
  type TraceResult,
} from '../../core/trace/traceImage';
import { NumberField } from '../common/fields';
import { Modal } from '../common/Modal';
import { RangeField } from '../common/RangeField';
import type { LoadedImage } from './loadImage';
import { createWorkerTracer, type Tracer } from './tracer';
import { TracePreview } from './TracePreview';

interface TraceDialogProps {
  image: LoadedImage;
  stock: Stock;
  onAdd: (object: DesignObject) => void;
  onClose: () => void;
  /** Swappable for tests; defaults to the Web Worker tracer. */
  createTracer?: (bitmap: LoadedImage['bitmap']) => Tracer;
}

/** Wait this long after the last slider change before re-tracing. */
const RETRACE_DELAY_MS = 120;

export function TraceDialog({
  image,
  stock,
  onAdd,
  onClose,
  createTracer = createWorkerTracer,
}: TraceDialogProps) {
  const { bitmap } = image;
  const [autoThreshold] = useState(() => otsuThreshold(bitmap));
  const [options, setOptions] = useState<TraceOptions>({
    ...DEFAULT_TRACE_OPTIONS,
    threshold: autoThreshold,
  });
  // null = auto-fit the current trace to the stock; a number once the user types one.
  const [typedWidth, setTypedWidth] = useState<number | null>(null);
  const [result, setResult] = useState<TraceResult | null>(null);
  const tracerRef = useRef<Tracer | null>(null);

  useEffect(() => {
    const tracer = createTracer(bitmap);
    tracerRef.current = tracer;
    return () => tracer.dispose();
  }, [bitmap, createTracer]);

  useEffect(() => {
    const timer = setTimeout(() => {
      tracerRef.current?.trace(options).then((r) => r && setResult(r));
    }, RETRACE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [options]);

  const set = (patch: Partial<TraceOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const art = artworkSize(result?.paths ?? []);
  const widthMm = typedWidth ?? suggestedWidth(art.width, art.height, stock);
  const heightMm = art.width > 0 ? (art.height * widthMm) / art.width : 0;
  const widthValid = Number.isFinite(widthMm) && widthMm > 0;
  const outlineCount = result?.paths.length ?? 0;

  const add = () => {
    if (!result) return;
    onAdd(
      createTracedObject({
        id: crypto.randomUUID(),
        name: image.name,
        paths: result.paths,
        widthMm,
        stock,
      }),
    );
  };

  return (
    <Modal
      title={`Trace “${image.name}”`}
      wide
      onClose={onClose}
      footer={
        <>
          <span className="muted small" aria-live="polite">
            {result ? `${outlineCount} outline${outlineCount === 1 ? '' : 's'}` : 'Tracing…'}
          </span>
          <span className="spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!result || outlineCount === 0 || !widthValid}
            onClick={add}
          >
            Add to design
          </button>
        </>
      }
    >
      <div className="trace-layout">
        <TracePreview
          imageUrl={image.previewUrl}
          imageWidth={bitmap.width}
          imageHeight={bitmap.height}
          result={result}
        />
        <div className="trace-controls">
          <RangeField
            label="Threshold"
            min={1}
            max={255}
            value={options.threshold}
            onChange={(threshold) => set({ threshold })}
            action={
              <button
                type="button"
                className="link-button"
                onClick={() => set({ threshold: autoThreshold })}
              >
                Auto
              </button>
            }
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.invert}
              onChange={(e) => set({ invert: e.target.checked })}
            />
            Invert (trace light shapes on a dark background)
          </label>
          <RangeField
            label="Smoothing"
            min={0}
            max={4}
            value={options.smoothing}
            onChange={(smoothing) => set({ smoothing })}
          />
          <RangeField
            label="Ignore specks smaller than"
            min={0}
            max={400}
            step={4}
            unit="px²"
            value={options.despeckle}
            onChange={(despeckle) => set({ despeckle })}
          />
          <NumberField
            label="Artwork width"
            unit="mm"
            min={1}
            value={widthMm}
            error={widthValid ? undefined : 'Width must be greater than 0.'}
            hint={widthValid ? `Height ${Math.round(heightMm * 10) / 10} mm` : undefined}
            onChange={setTypedWidth}
          />
        </div>
      </div>
    </Modal>
  );
}
