import { useJobStore } from '../../state/jobStore';
import { CutPlan } from '../toolpaths/CutPlan';
import { ObjectPanel } from './ObjectPanel';
import { SelectionPanel } from './SelectionPanel';

/**
 * The one panel on the right. Nothing selected: the cut plan. Otherwise the
 * inspector for what's selected: one shape (with its cuts), or several.
 * Picking a cut in the plan selects its shape with that cut open.
 */
export function Sidebar() {
  const count = useJobStore((s) => s.selectedIds.length);
  const single = useJobStore((s) =>
    s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined,
  );

  if (count === 0) {
    return (
      <aside className="sidebar sidebar-plan">
        <CutPlan />
      </aside>
    );
  }
  return (
    <aside className="sidebar">
      {single ? <ObjectPanel key={single.id} object={single} /> : <SelectionPanel count={count} />}
    </aside>
  );
}
