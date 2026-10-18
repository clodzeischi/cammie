import { useJobStore } from '../../state/jobStore';
import { useGeneratedJob } from '../../state/useGeneratedJob';
import { DiagnosticsList } from './DiagnosticsList';
import { JobPanel } from './JobPanel';
import { ObjectPanel } from './ObjectPanel';
import { SelectionPanel } from './SelectionPanel';

export function Sidebar() {
  const count = useJobStore((s) => s.selectedIds.length);
  const single = useJobStore((s) =>
    s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined,
  );
  const { diagnostics } = useGeneratedJob();

  return (
    <aside className="sidebar">
      {single ? (
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
