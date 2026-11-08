import { arrange } from '../../state/arrangeActions';
import { useJobStore } from '../../state/jobStore';
import { ArrangeFields } from './ArrangeFields';
import { ObjectCuts } from './ObjectCuts';

interface SelectionPanelProps {
  count: number;
}

/** Shown when several objects (or a group) are selected. */
export function SelectionPanel({ count }: SelectionPanelProps) {
  const select = useJobStore((s) => s.select);

  return (
    <section className="panel" aria-label="Selected objects">
      <div className="panel-heading">
        <button type="button" className="link-button" onClick={() => select(null)}>
          Done
        </button>
        <h2 className="panel-title">{count} shapes</h2>
      </div>
      <ObjectCuts count={count} />
      <ArrangeFields />
      <p className="muted small">Shift-click to add or remove shapes.</p>
      <button type="button" className="button button-danger" onClick={arrange.remove}>
        Delete {count} shapes
      </button>
    </section>
  );
}
