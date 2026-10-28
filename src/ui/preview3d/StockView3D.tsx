import { useEffect, useRef, useState } from 'react';
import { lookOf } from '../../core/materials/materialLooks';
import { useGeneratedJob, useJob } from '../../state/useGeneratedJob';
import type { SimResponse } from '../../workers/sim.worker';
import { useCanvasColors } from '../canvas/canvasColors';
import { createStockScene, type CameraView, type StockScene } from './scene';
import { createSimulator, type Simulator } from './simulator';

/** Wait this long (ms) after the last change before carving again. */
const DEBOUNCE_MS = 250;

const VIEWS: ReadonlyArray<{ value: CameraView; label: string }> = [
  { value: 'angled', label: 'Angled' },
  { value: 'top', label: 'Top' },
  { value: 'underneath', label: 'Underneath' },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * The finished piece in 3D: the stock in its material, carved by every
 * exported file, with loose pieces lifted out (SPEC.md §10.1). Loaded only
 * when first opened, since three.js is big.
 */
export default function StockView3D() {
  const job = useJob();
  const { programs } = useGeneratedJob();
  const colors = useCanvasColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StockScene | null>(null);
  const simulatorRef = useRef<Simulator | null>(null);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const scene = createStockScene(containerRef.current!, colors);
    const simulator = createSimulator();
    sceneRef.current = scene;
    simulatorRef.current = simulator;
    return () => {
      scene.dispose();
      simulator.dispose();
    };
    // Colours are applied by the effect below; the scene is made once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => sceneRef.current?.setColors(colors), [colors]);

  useEffect(() => {
    const { stock, origin, flip, materialId } = job;
    const timer = setTimeout(async () => {
      setBusy(true);
      const carved = await simulatorRef.current?.run({ stock, origin, flip }, programs);
      if (!carved) return; // replaced by a newer request
      sceneRef.current?.show(carved, stock, lookOf(materialId));
      setResult(carved);
      setBusy(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [job, programs]);

  const loose = result?.meshes.loose.length ?? 0;
  return (
    <div className="stock-3d">
      <div ref={containerRef} className="stock-3d-canvas" />
      {busy && <div className="stock-3d-status">Carving…</div>}
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
