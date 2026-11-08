import { useJobStore } from '../../state/jobStore';
import { MOD_KEY } from '../common/platform';
import { Icon } from '../icons/Icon';

/** Undo and redo, in the header. */
export function HistoryButtons() {
  const canUndo = useJobStore((s) => s.history.past.length > 0);
  const canRedo = useJobStore((s) => s.history.future.length > 0);
  const undo = useJobStore((s) => s.undo);
  const redo = useJobStore((s) => s.redo);

  return (
    <div className="history-buttons" role="group" aria-label="History">
      <button
        type="button"
        className="button"
        title={`Undo (${MOD_KEY}Z)`}
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
      >
        <Icon name="undo" size={16} />
      </button>
      <button
        type="button"
        className="button"
        title={`Redo (${MOD_KEY}⇧Z)`}
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
      >
        <Icon name="redo" size={16} />
      </button>
    </div>
  );
}
