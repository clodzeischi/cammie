import { formatDuration, type ProgramStats } from '../../core/cam/estimate';
import type { BitProgram } from '../../core/cam/program';
import { Icon } from '../icons/Icon';

interface PreviewBarProps {
  programs: BitProgram[];
  stats: ProgramStats[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  /** 0–1 share of the active program's moves shown as done. */
  progress: number;
  onProgressChange: (progress: number) => void;
  showCutWidth: boolean;
  onShowCutWidthChange: (show: boolean) => void;
}

const SLIDER_STEPS = 1000;

/** Per-file stats, the playback scrubber and display toggles. */
export function PreviewBar(props: PreviewBarProps) {
  const { programs, stats, activeIndex, progress } = props;
  const active = stats[activeIndex];

  if (programs.length === 0) {
    return <div className="preview-bar muted">Nothing to cut yet.</div>;
  }

  return (
    <div className="preview-bar">
      {programs.length > 1 && (
        <div className="segmented" role="tablist" aria-label="File">
          {programs.map((program, i) => (
            <button
              key={program.bit.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? 'segment segment-active' : 'segment'}
              onClick={() => props.onActiveChange(i)}
            >
              {i + 1}. {program.bit.name}
            </button>
          ))}
        </div>
      )}
      {active && (
        <dl className="stats">
          <div title="Doesn't include acceleration, so expect 10–20% longer">
            <dt>Time</dt>
            <dd>~{formatDuration(active.seconds)}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{(active.cutLength / 1000).toFixed(2)} m</dd>
          </div>
          <div>
            <dt>Depth</dt>
            <dd>{active.maxDepth.toFixed(2)} mm</dd>
          </div>
        </dl>
      )}
      <input
        className="scrubber"
        aria-label="Playback"
        title="Play the cut back"
        type="range"
        min={0}
        max={SLIDER_STEPS}
        value={Math.round(progress * SLIDER_STEPS)}
        onChange={(e) => props.onProgressChange(Number(e.target.value) / SLIDER_STEPS)}
      />
      <button
        type="button"
        className={props.showCutWidth ? 'icon-button icon-button-on' : 'icon-button'}
        aria-pressed={props.showCutWidth}
        aria-label="Show cut width"
        title="Show cut width"
        onClick={() => props.onShowCutWidthChange(!props.showCutWidth)}
      >
        <Icon name="cutWidth" size={18} />
      </button>
    </div>
  );
}
