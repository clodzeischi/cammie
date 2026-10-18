import { GRID_SPACINGS } from '../../core/job/grid';
import { useGridStore } from '../../state/gridStore';

/** Snap on/off and grid size, in the canvas's corner toolbar. */
export function GridControls() {
  const spacing = useGridStore((s) => s.spacing);
  const snap = useGridStore((s) => s.snap);
  const setSpacing = useGridStore((s) => s.setSpacing);
  const setSnap = useGridStore((s) => s.setSnap);

  return (
    <div className="grid-controls">
      <label
        className="checkbox"
        title="Objects and resize handles snap to the grid. Hold Alt/Option while dragging to place freely."
      >
        <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
        Snap
      </label>
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
