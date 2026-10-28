import { isTwoSided, type SideView } from '../../core/job/faces';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { useActiveSide } from '../../state/useActiveSide';

const SIDES: ReadonlyArray<{ value: SideView; label: string; title: string }> = [
  { value: 'both', label: 'Both sides', title: 'Show every shape and file' },
  { value: 'top', label: 'Top', title: 'Hide shapes cut only from the bottom' },
  { value: 'bottom', label: 'Bottom', title: 'Hide shapes cut only from the top' },
];

/**
 * Pro, two-sided jobs: work on one side without the other in the way. New
 * cuts are added to the side shown. Export always includes both.
 */
export function SideSwitch() {
  const side = useActiveSide();
  const setSideView = useJobStore((s) => s.setSideView);
  const twoSided = useJobStore(isTwoSided);
  const pro = useModeStore((s) => s.mode === 'pro');
  if (!pro || !twoSided) return null;

  return (
    <div className="segmented" role="radiogroup" aria-label="Side shown">
      {SIDES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={side === s.value}
          title={s.title}
          className={side === s.value ? 'segment segment-active' : 'segment'}
          onClick={() => setSideView(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
