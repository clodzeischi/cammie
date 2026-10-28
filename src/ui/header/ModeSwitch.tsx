import { useJobStore } from '../../state/jobStore';
import { useModeStore, type ModeState } from '../../state/modeStore';

/** Easy ↔ Pro. Switching never changes the design; Pro-only jobs show read-only in Easy. */
export function ModeSwitch() {
  const mode = useModeStore((s) => s.mode);
  const setModeOnly = useModeStore((s) => s.setMode);
  const setSideView = useJobStore((s) => s.setSideView);
  // Easy has no side switch, so it always shows both sides.
  const setMode: ModeState['setMode'] = (next) => {
    if (next === 'easy') setSideView('both');
    setModeOnly(next);
  };
  const pro = mode === 'pro';

  return (
    <div className="mode-switch">
      <button
        type="button"
        className={pro ? 'mode-label' : 'mode-label mode-label-on'}
        onClick={() => setMode('easy')}
      >
        Easy
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={pro}
        aria-label="Pro mode"
        title={pro ? 'Switch to Easy mode' : 'Switch to Pro mode: several bits and cuts per shape'}
        className="switch"
        onClick={() => setMode(pro ? 'easy' : 'pro')}
      />
      <button
        type="button"
        className={pro ? 'mode-label mode-label-on' : 'mode-label'}
        onClick={() => setMode('pro')}
      >
        Pro
      </button>
    </div>
  );
}
