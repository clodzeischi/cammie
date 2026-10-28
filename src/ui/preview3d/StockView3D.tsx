import { useEffect, useMemo, useRef, useState } from 'react';
import { lookOf } from '../../core/materials/materialLooks';
import { useDragPreviewStore } from '../../state/dragPreviewStore';
import { useMachineStore } from '../../state/machineStore';
import { useToolingStore } from '../../state/toolingStore';
import { useJob } from '../../state/useGeneratedJob';
import type { SimResponse } from '../../workers/sim.worker';
import { useCanvasColors } from '../canvas/canvasColors';
import { createStockScene, type CameraView, type StockScene } from './scene';
import { createLiveCarver, type LiveCarver } from './simulator';

const VIEWS: ReadonlyArray<{ value: CameraView; label: string }> = [
  { value: 'angled', label: 'Angled' },
  { value: 'top', label: 'Top' },
  { value: 'underneath', label: 'Underneath' },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * The finished piece in 3D, beside the design: the stock in its material,
 * carved by every exported file, with loose pieces lifted out (SPEC.md
 * §10.1). Follows shapes while they're dragged. Loaded only when first
 * opened, since three.js is big.
 */
export default function StockView3D() {
  const job = useJob();
  const live = useDragPreviewStore((s) => s.transforms);
  const machine = useMachineStore((s) => s.config);
  const bits = useToolingStore((s) => s.bits);
  const feedOverrides = useToolingStore((s) => s.feedOverrides);
  const colors = useCanvasColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StockScene | null>(null);
  const carverRef = useRef<LiveCarver | null>(null);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const scene = createStockScene(containerRef.current!, colors);
    const carver = createLiveCarver((carved, input, full) => {
      scene.show(carved, input.job.stock, lookOf(input.job.materialId));
      if (full) setResult(carved);
    }, setBusy);
    sceneRef.current = scene;
    carverRef.current = carver;
    return () => {
      carver.dispose();
      scene.dispose();
    };
    // Colours are applied by the effect below; the scene is made once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => sceneRef.current?.setColors(colors), [colors]);

  // Shapes being dragged count at their live position.
  const shown = useMemo(
    () =>
      live
        ? {
            ...job,
            objects: job.objects.map((o) => ({ ...o, transform: live[o.id] ?? o.transform })),
          }
        : job,
    [job, live],
  );
  useEffect(() => {
    carverRef.current?.update({ job: shown, machine, bits: [...bits], feedOverrides });
  }, [shown, machine, bits, feedOverrides]);

  const loose = result?.meshes.loose.length ?? 0;
  return (
    <div className="stock-3d">
      <div ref={containerRef} className="stock-3d-canvas" />
      {busy && <div className="stock-3d-status">Updating…</div>}
      <div className="stock-3d-bar">
        <div className="segmented" role="group" aria-label="Camera">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              className="segment"
              onClick={() => sceneRef.current?.setView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {result && (
          <ul className="stock-3d-notes small">
            {loose > 0 && (
              <li className="stock-3d-loose">
                {loose === 1 ? '1 piece comes loose' : `${loose} pieces come loose`} (shown lifted
                out and highlighted). Add tabs if it should stay put.
              </li>
            )}
            {result.maxSpoil > 0.01 && (
              <li>Cuts up to {round2(result.maxSpoil)} mm into the spoilboard.</li>
            )}
            <li className="muted">
              Shows the result of every file, accurate to about {round2(result.cell)} mm.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
