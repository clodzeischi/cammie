import { useJobStore } from '../../state/jobStore';
import { MOD_KEY } from '../common/platform';

export function HistoryButtons() {
  const canUndo = useJobStore((s) => s.history.past.length > 0);
  const canRedo = useJobStore((s) => s.history.future.length > 0);
  const undo = useJobStore((s) => s.undo);
  const redo = useJobStore((s) => s.redo);

  return (
    <div className="toolbar-group" role="group" aria-label="History">
      <button
        type="button"
        className="tool-button"
        title={`Undo (${MOD_KEY}Z)`}
        disabled={!canUndo}
        onClick={undo}
      >
        <span aria-hidden="true">↶</span>
        <span className="tool-label">Undo</span>
      </button>
      <button
        type="button"
        className="tool-button"
        title={`Redo (${MOD_KEY}⇧Z)`}
        disabled={!canRedo}
        onClick={redo}
      >
        <span aria-hidden="true">↷</span>
        <span className="tool-label">Redo</span>
      </button>
    </div>
  );
}
