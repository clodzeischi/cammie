import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { useGeneratedJob } from '../../state/useGeneratedJob';
import { DiagnosticsList } from './DiagnosticsList';
import { JobPanel } from './JobPanel';
import { ObjectPanel } from './ObjectPanel';
import { SelectionPanel } from './SelectionPanel';
import { ToolpathPanel } from './ToolpathPanel';

export function Sidebar() {
  const pro = useModeStore((s) => s.mode === 'pro');
  const toolpath = useJobStore((s) =>
    s.selectedToolpathId ? s.toolpaths.find((t) => t.id === s.selectedToolpathId) : undefined,
  );
  const count = useJobStore((s) => s.selectedIds.length);
  const single = useJobStore((s) =>
    s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined,
  );
  const { diagnostics } = useGeneratedJob();

  return (
    <aside className="sidebar">
      {pro && toolpath ? (
        <ToolpathPanel key={toolpath.id} toolpath={toolpath} />
      ) : single ? (
        <ObjectPanel key={single.id} object={single} />
      ) : count > 1 ? (
        <SelectionPanel count={count} />
      ) : (
        <JobPanel />
      )}
      <DiagnosticsList diagnostics={diagnostics} />
    </aside>
  );
}
