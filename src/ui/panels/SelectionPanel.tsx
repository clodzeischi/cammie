import { arrange } from '../../state/arrangeActions';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { ArrangeFields } from './ArrangeFields';
import { EasyCutFields } from './EasyCutFields';
import { ObjectToolpaths } from './ObjectToolpaths';

interface SelectionPanelProps {
  count: number;
}

/** Shown when several objects (or a group) are selected. */
export function SelectionPanel({ count }: SelectionPanelProps) {
  const select = useJobStore((s) => s.select);
  const selectedIds = useJobStore((s) => s.selectedIds);
  const mode = useModeStore((s) => s.mode);

  return (
    <section className="panel" aria-label="Selected objects">
      <div className="panel-heading">
        <button type="button" className="link-button" onClick={() => select(null)}>
          ← Job
        </button>
        <h2 className="panel-title">{count} objects</h2>
      </div>
      {mode === 'easy' ? <EasyCutFields objectIds={selectedIds} /> : <ObjectToolpaths />}
      <ArrangeFields />
      <p className="muted small">Shift-click to add or remove objects.</p>
      <button type="button" className="button button-danger" onClick={arrange.remove}>
        Delete {count} objects
      </button>
    </section>
  );
}
