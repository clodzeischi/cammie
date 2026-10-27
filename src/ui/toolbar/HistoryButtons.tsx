import { useJobStore } from '../../state/jobStore';
import { MOD_KEY } from '../common/platform';
import { RibbonButton } from '../ribbon/RibbonButton';

export function HistoryButtons() {
  const canUndo = useJobStore((s) => s.history.past.length > 0);
  const canRedo = useJobStore((s) => s.history.future.length > 0);
  const undo = useJobStore((s) => s.undo);
  const redo = useJobStore((s) => s.redo);

  return (
    <>
      <RibbonButton
        icon="undo"
        label="Undo"
        title={`Undo (${MOD_KEY}Z)`}
        disabled={!canUndo}
        onClick={undo}
      />
      <RibbonButton
        icon="redo"
        label="Redo"
        title={`Redo (${MOD_KEY}⇧Z)`}
        disabled={!canRedo}
        onClick={redo}
      />
    </>
  );
}
