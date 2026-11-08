import { useJobStore } from '../../state/jobStore';
import { CutPlan } from '../toolpaths/CutPlan';
import { ObjectPanel } from './ObjectPanel';
import { SelectionPanel } from './SelectionPanel';
import { ToolpathPanel } from './ToolpathPanel';

/**
 * The one panel on the right. Nothing selected: the cut plan. Otherwise the
 * inspector for what's selected: a cut, one shape, or several.
 */
export function Sidebar() {
  const toolpath = useJobStore((s) =>
    s.selectedToolpathId ? s.toolpaths.find((t) => t.id === s.selectedToolpathId) : undefined,
  );
  const count = useJobStore((s) => s.selectedIds.length);
  const single = useJobStore((s) =>
    s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined,
  );

  if (!toolpath && count === 0) {
    return (
      <aside className="sidebar sidebar-plan">
        <CutPlan />
      </aside>
    );
  }
  return (
    <aside className="sidebar">
      {toolpath ? (
        <ToolpathPanel key={toolpath.id} toolpath={toolpath} />
      ) : single ? (
        <ObjectPanel key={single.id} object={single} />
      ) : (
        <SelectionPanel count={count} />
      )}
    </aside>
  );
}
