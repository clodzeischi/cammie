import { useMemo, useState } from 'react';
import { estimateProgram } from '../core/cam/estimate';
import { anchorPoint } from '../core/job/job';
import { useJobStore } from '../state/jobStore';
import { useMachineStore } from '../state/machineStore';
import { useGeneratedJob } from '../state/useGeneratedJob';
import { DesignCanvas } from './canvas/DesignCanvas';
import { buildPreview } from './canvas/toolpathRuns';
import { PreviewBar } from './preview/PreviewBar';

/** The canvas with its Design / Preview switch and, in preview, the playback bar. */
export function Workspace() {
  const view = useJobStore((s) => s.view);
  const setView = useJobStore((s) => s.setView);
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const machine = useMachineStore((s) => s.config);
  const { programs, tabs } = useGeneratedJob();

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(1);
  const [showCutWidth, setShowCutWidth] = useState(true);

  const previews = useMemo(() => {
    const o = anchorPoint(stock, origin);
    return programs.map((p) => buildPreview(p, o));
  }, [programs, stock, origin]);
  const stats = useMemo(
    () => programs.map((p) => estimateProgram(p, machine)),
    [programs, machine],
  );

  const active = Math.min(activeIndex, Math.max(programs.length - 1, 0));
  const inPreview = view === 'preview';
  const done = Math.round(progress * (previews[active]?.moveCount ?? 0));

  return (
    <main className="workspace">
      <div className="segmented view-toggle" role="tablist" aria-label="View">
        {(['design', 'preview'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'segment segment-active' : 'segment'}
            onClick={() => setView(v)}
          >
            {v === 'design' ? 'Design' : 'Toolpath preview'}
          </button>
        ))}
      </div>
      <DesignCanvas
        preview={inPreview ? { previews, activeIndex: active, done, showCutWidth, tabs } : null}
      />
      {inPreview && (
        <PreviewBar
          programs={programs}
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
    </main>
  );
}
