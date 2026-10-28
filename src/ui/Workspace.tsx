import { lazy, Suspense, useMemo, useState } from 'react';
import { estimateProgram } from '../core/cam/estimate';
import { cutFrame, faceOf } from '../core/job/faces';
import { useJobStore } from '../state/jobStore';
import { useMachineStore } from '../state/machineStore';
import { useGeneratedJob } from '../state/useGeneratedJob';
import { useView3DStore } from '../state/view3dStore';
import { useActiveSide } from '../state/useActiveSide';
import { DesignCanvas } from './canvas/DesignCanvas';
import { SideSwitch } from './canvas/SideSwitch';
import { buildPreview } from './canvas/toolpathRuns';
import { PreviewBar } from './preview/PreviewBar';
import { SplitDivider } from './SplitDivider';

// three.js is big, so the 3D view loads the first time it's opened.
const StockView3D = lazy(() => import('./preview3d/StockView3D'));

const VIEW_LABELS = { design: 'Design', preview: 'Toolpath preview' } as const;

/**
 * The canvas with its Design / Toolpath preview switch (and, in preview, the
 * playback bar), and beside it the 3D view of the finished piece, which
 * follows every change.
 */
export function Workspace() {
  const view = useJobStore((s) => s.view);
  const setView = useJobStore((s) => s.setView);
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const flip = useJobStore((s) => s.flip);
  const machine = useMachineStore((s) => s.config);
  const generated = useGeneratedJob();
  const toolpaths = useJobStore((s) => s.toolpaths);
  const side = useActiveSide();
  const pane3d = useView3DStore();
  // Files keep their real numbers when the other side's are hidden.
  const { programs, fileNumbers, tabs } = useMemo(() => {
    const shown = generated.programs
      .map((program, i) => ({ program, number: i + 1 }))
      .filter(({ program }) => side === 'both' || program.face === side);
    return {
      programs: shown.map((s) => s.program),
      fileNumbers: shown.map((s) => s.number),
      tabs: generated.tabs.filter((t) => {
        const toolpath = toolpaths.find((tp) => tp.id === t.toolpathId);
        return side === 'both' || (toolpath && faceOf(toolpath) === side);
      }),
    };
  }, [generated, side, toolpaths]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(1);
  const [showCutWidth, setShowCutWidth] = useState(true);

  const previews = useMemo(
    () => programs.map((p) => buildPreview(p, cutFrame({ stock, origin, flip }, p.face))),
    [programs, stock, origin, flip],
  );
  const stats = useMemo(
    () => programs.map((p) => estimateProgram(p, machine)),
    [programs, machine],
  );

  const active = Math.min(activeIndex, Math.max(programs.length - 1, 0));
  const inPreview = view === 'preview';
  const done = Math.round(progress * (previews[active]?.moveCount ?? 0));

  return (
    <main
      className="workspace"
      style={
        pane3d.open
          ? { gridTemplateColumns: `${1 - pane3d.share}fr auto ${pane3d.share}fr` }
          : undefined
      }
    >
      <section className="workspace-canvas" aria-label="Design">
        <div className="canvas-toolbar">
          <div className="segmented" role="tablist" aria-label="View">
            {(['design', 'preview'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={view === v ? 'segment segment-active' : 'segment'}
                onClick={() => setView(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={pane3d.open ? 'segment-toggle segment-toggle-on' : 'segment-toggle'}
            aria-pressed={pane3d.open}
            title={
              pane3d.open ? 'Hide the 3D view' : 'Show the finished piece in 3D, beside the design'
            }
            onClick={pane3d.toggle}
          >
            3D
          </button>
          <SideSwitch />
        </div>
        <DesignCanvas
          preview={inPreview ? { previews, activeIndex: active, done, showCutWidth, tabs } : null}
        />
        {inPreview && (
          <PreviewBar
            programs={programs}
            fileNumbers={fileNumbers}
            stats={stats}
            activeIndex={active}
            onActiveChange={(i) => {
              setActiveIndex(i);
              setProgress(1);
            }}
            progress={progress}
            onProgressChange={setProgress}
            showCutWidth={showCutWidth}
            onShowCutWidthChange={setShowCutWidth}
          />
        )}
      </section>
      {pane3d.open && (
        <>
          <SplitDivider
            share={pane3d.share}
            onChange={pane3d.setShare}
            label="Resize the 3D view"
          />
          <section className="workspace-3d" aria-label="3D view">
            <Suspense fallback={<div className="stock-3d-status">Loading 3D view…</div>}>
              <StockView3D />
            </Suspense>
          </section>
        </>
      )}
    </main>
  );
}
