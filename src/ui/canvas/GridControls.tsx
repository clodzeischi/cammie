import { GRID_SPACINGS } from '../../core/job/grid';
import { useGridStore } from '../../state/gridStore';
import { Icon } from '../icons/Icon';

/** Cut shading on/off, snap on/off and grid size, in the canvas's corner toolbar. */
export function GridControls() {
  const spacing = useGridStore((s) => s.spacing);
  const snap = useGridStore((s) => s.snap);
  const setSpacing = useGridStore((s) => s.setSpacing);
  const setSnap = useGridStore((s) => s.setSnap);
  const showCuts = useGridStore((s) => s.showCuts);
  const setShowCuts = useGridStore((s) => s.setShowCuts);

  return (
    <div className="grid-controls">
      <button
        type="button"
        className={showCuts ? 'icon-button icon-button-on' : 'icon-button'}
        aria-pressed={showCuts}
        aria-label="Shade cuts"
        title="Shade what each cut removes"
        onClick={() => setShowCuts(!showCuts)}
      >
        <Icon name="shading" size={18} />
      </button>
      <button
        type="button"
        className={snap ? 'icon-button icon-button-on' : 'icon-button'}
        aria-pressed={snap}
        aria-label="Snap to grid"
        title="Snap to grid (hold Alt to place freely)"
        onClick={() => setSnap(!snap)}
      >
        <Icon name="magnet" size={18} />
      </button>
      <select
        aria-label="Grid size"
        title="Grid size"
        value={spacing}
        onChange={(e) => setSpacing(Number(e.target.value))}
      >
        {GRID_SPACINGS.map((s) => (
          <option key={s} value={s}>
            {s} mm
          </option>
        ))}
      </select>
    </div>
  );
}
