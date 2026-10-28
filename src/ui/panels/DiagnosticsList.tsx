import type { Diagnostic } from '../../core/cam/program';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';

interface DiagnosticsListProps {
  diagnostics: Diagnostic[];
}

/** Errors (block export) first, then warnings. Clicking one selects its toolpath (Pro) or object. */
export function DiagnosticsList({ diagnostics }: DiagnosticsListProps) {
  const select = useJobStore((s) => s.select);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const mode = useModeStore((s) => s.mode);
  const setView = useJobStore((s) => s.setView);
  const objects = useJobStore((s) => s.objects);
  if (diagnostics.length === 0) {
    return objects.length > 0 ? <p className="checks-ok small">✓ Ready to export</p> : null;
  }

  const sorted = [...diagnostics].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
  return (
    <section className="panel" aria-label="Checks">
      <h2 className="panel-title">Checks</h2>
      <ul className="checks">
        {sorted.map((d, i) => (
          <li key={i} className={`check check-${d.severity}`}>
            <span className="check-icon" aria-label={d.severity}>
              {d.severity === 'error' ? '✕' : '!'}
            </span>
            {d.objectId ? (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setView('design');
                  if (mode === 'pro' && d.toolpathId) selectToolpath(d.toolpathId);
                  else select(d.objectId!);
                }}
              >
                {d.message}
              </button>
            ) : (
              <span>{d.message}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
