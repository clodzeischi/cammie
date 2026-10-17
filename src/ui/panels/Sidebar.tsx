import { useJobStore } from '../../state/jobStore';
import { useGeneratedJob } from '../../state/useGeneratedJob';
import { DiagnosticsList } from './DiagnosticsList';
import { JobPanel } from './JobPanel';
import { ObjectPanel } from './ObjectPanel';

export function Sidebar() {
  const selected = useJobStore((s) => s.objects.find((o) => o.id === s.selectedId));
  const { diagnostics } = useGeneratedJob();

  return (
    <aside className="sidebar">
      {selected ? <ObjectPanel key={selected.id} object={selected} /> : <JobPanel />}
      <DiagnosticsList diagnostics={diagnostics} />
    </aside>
  );
}
