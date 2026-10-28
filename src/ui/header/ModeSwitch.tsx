import { fitsEasyMode } from '../../core/job/toolpaths';
import { useJobStore } from '../../state/jobStore';
import { useModeStore, type ModeState } from '../../state/modeStore';

/** Shown on hover when Easy is out of reach. */
export const EASY_BLOCKED_MESSAGE = 'Cannot switch, Pro features in use';

/**
 * Easy ↔ Pro. Switching never changes the design. From Pro, Easy is blocked
 * while the job uses anything Easy can't show (see fitsEasyMode); a Pro job
 * opened in Easy still shows read-only behind the Easy gate.
 */
export function ModeSwitch() {
  const mode = useModeStore((s) => s.mode);
  const setModeOnly = useModeStore((s) => s.setMode);
  const setSideView = useJobStore((s) => s.setSideView);
  const fitsEasy = useJobStore(fitsEasyMode);
  // Easy has no side switch, so it always shows both sides.
  const setMode: ModeState['setMode'] = (next) => {
    if (next === 'easy') setSideView('both');
    setModeOnly(next);
  };
  const pro = mode === 'pro';
  const blocked = pro && !fitsEasy;

  return (
    // Disabled buttons don't reliably show tooltips, so the message sits on the wrapper.
    <div
      className={blocked ? 'mode-switch mode-switch-blocked' : 'mode-switch'}
      title={blocked ? EASY_BLOCKED_MESSAGE : undefined}
    >
      <button
        type="button"
        className={pro ? 'mode-label' : 'mode-label mode-label-on'}
        disabled={blocked}
        onClick={() => setMode('easy')}
      >
        Easy
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={pro}
        aria-label="Pro mode"
        aria-description={blocked ? EASY_BLOCKED_MESSAGE : undefined}
        title={
          blocked
            ? undefined
            : pro
              ? 'Switch to Easy mode'
              : 'Switch to Pro mode: several bits and cuts per shape'
        }
        className="switch"
        disabled={blocked}
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
