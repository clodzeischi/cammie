import { arrange } from '../../state/arrangeActions';
import { useJobStore } from '../../state/jobStore';
import { ArrangeFields } from './ArrangeFields';

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
          ← Job
        </button>
        <h2 className="panel-title">{count} objects</h2>
      </div>
      <ArrangeFields />
      <p className="muted small">
        Shift-click to add or remove objects. To set how something is cut, select it on its own
        (ungroup first if it's in a group).
      </p>
      <button type="button" className="button button-danger" onClick={arrange.remove}>
        Delete {count} objects
      </button>
    </section>
  );
}
