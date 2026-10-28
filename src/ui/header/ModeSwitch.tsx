import { useModeStore } from '../../state/modeStore';

/** Easy ↔ Pro. Switching never changes the design; Pro-only jobs show read-only in Easy. */
export function ModeSwitch() {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
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
