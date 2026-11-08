import type { Diagnostic } from '../../core/cam/program';
import { cutKindOf } from '../../core/job/objectFactory';
import { moveGroup, moveToolpath, toolpathGroups } from '../../core/job/toolpaths';
import { bitDetail, findBit } from '../../core/tools/bits';
import { useDialogStore } from '../../state/dialogStore';
import { useJobStore } from '../../state/jobStore';
import { useGeneratedJob } from '../../state/useGeneratedJob';
import { useToolingStore } from '../../state/toolingStore';
import { bitIcon } from '../bitIcons';
import { CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';
import { DiagnosticsList } from '../panels/DiagnosticsList';

/** The worst problem reported for each toolpath, for the dot on its row. */
function severities(diagnostics: readonly Diagnostic[]) {
  const worst = new Map<string, Diagnostic['severity']>();
  for (const d of diagnostics) {
    if (!d.toolpathId || worst.get(d.toolpathId) === 'error') continue;
    worst.set(d.toolpathId, d.severity);
  }
  return worst;
}

/**
 * The cut plan, shown in the right panel while nothing is selected: every
 * cut, top to bottom in cut order. Each bit is one file; the steps between
 * files say what to do at the machine. Checks and auto-arrange sit underneath.
 */
export function CutPlan() {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const objects = useJobStore((s) => s.objects);
  const selectedId = useJobStore((s) => s.selectedToolpathId);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const setToolpaths = useJobStore((s) => s.setToolpaths);
  const removeToolpaths = useJobStore((s) => s.removeToolpaths);
  const bits = useToolingStore((s) => s.bits);
  const { diagnostics } = useGeneratedJob();
  const problems = severities(diagnostics);
  const groups = toolpathGroups(toolpaths);
  const nameOf = (id: string) => objects.find((o) => o.id === id)?.name ?? 'Missing object';

  return (
    <section className="toolpath-pane" aria-label="Cut plan">
      <div className="pane-head">
        <h2 className="pane-title">Cut plan</h2>
        {groups.length > 0 && (
          <span className="muted small">
            {groups.length} {groups.length === 1 ? 'file' : 'files'}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <GettingStarted hasShapes={objects.length > 0} />
      ) : (
        <ol className="toolpath-groups">
          {groups.map((group, gi) => {
            const bit = findBit(group.bitId, bits);
            return (
              <li key={group.bitId} className="toolpath-group">
                {gi > 0 && (
                  <div className="toolpath-step">
                    <Icon name="bitChange" size={16} />
                    <span>
                      <b>Change bit</b> to {bit?.name ?? 'the next bit'}, then re-zero Z
                    </span>
                  </div>
                )}
                <div className="toolpath-group-head">
                  <span className="file-number" aria-label={`File ${gi + 1}`}>
                    {gi + 1}
                  </span>
                  <Icon name={bitIcon(bit)} size={18} />
                  <span className="toolpath-group-name">
                    <b>{bit?.name ?? 'Missing bit'}</b>
                    {bit && <small>{bitDetail(bit)}</small>}
                  </span>
                  {groups.length > 1 && (
                    <span className="row-actions">
                      <button
                        type="button"
                        className="mini-button"
                        aria-label={`Run ${bit?.name ?? 'this bit'} earlier`}
                        title="Run this file earlier"
                        disabled={gi === 0}
                        onClick={() => setToolpaths(moveGroup(toolpaths, group.bitId, -1))}
                      >
                        <Icon name="chevronUp" size={14} />
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        aria-label={`Run ${bit?.name ?? 'this bit'} later`}
                        title="Run this file later"
                        disabled={gi === groups.length - 1}
                        onClick={() => setToolpaths(moveGroup(toolpaths, group.bitId, 1))}
                      >
                        <Icon name="chevronDown" size={14} />
                      </button>
                    </span>
                  )}
                </div>
                <ol className="toolpath-rows">
                  {group.toolpaths.map((t, ti) => {
                    const kind = CUT_KINDS[cutKindOf(t.operation)];
                    const problem = problems.get(t.id);
                    const name = nameOf(t.objectId);
                    return (
                      <li
                        key={t.id}
                        className="toolpath-row"
                        aria-current={t.id === selectedId ? 'true' : undefined}
                      >
                        <button
                          type="button"
                          className="toolpath-select"
                          onClick={() => selectToolpath(t.id)}
                        >
                          <span style={{ color: kind.color }}>
                            <Icon name={kind.icon} size={20} />
                          </span>
                          <span className="toolpath-name">
                            <b>{name}</b>
                            <small>{kind.name}</small>
                          </span>
                          {problem && (
                            <span
                              className={`problem-dot problem-${problem}`}
                              aria-label={problem === 'error' ? 'Has an error' : 'Has a warning'}
                            />
                          )}
                          <span className="toolpath-depth">{t.operation.depth}</span>
                        </button>
                        <span className="row-actions">
                          <button
                            type="button"
                            className="mini-button"
                            aria-label={`Move ${kind.name} on ${name} up`}
                            disabled={ti === 0}
                            onClick={() => setToolpaths(moveToolpath(toolpaths, t.id, -1))}
                          >
                            <Icon name="chevronUp" size={14} />
                          </button>
                          <button
                            type="button"
                            className="mini-button"
                            aria-label={`Move ${kind.name} on ${name} down`}
                            disabled={ti === group.toolpaths.length - 1}
                            onClick={() => setToolpaths(moveToolpath(toolpaths, t.id, 1))}
                          >
                            <Icon name="chevronDown" size={14} />
                          </button>
                          <button
                            type="button"
                            className="mini-button"
                            aria-label={`Delete ${kind.name} on ${name}`}
                            onClick={() => removeToolpaths([t.id])}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
      )}
      {groups.length > 0 && (
        <p className="pane-hint">
          Top to bottom is the cut order. Each bit is one file. New cuts go where they're safest:
          holes and pockets first, cut-outs last. Click a cut to change it.
        </p>
      )}
      {objects.length > 0 && (
        <div className="toolpath-checks">
          <DiagnosticsList diagnostics={diagnostics} />
        </div>
      )}
      {objects.length > 1 && (
        <div className="plan-actions">
          <button
            type="button"
            className="button button-small"
            title="Pack the shapes onto the stock to leave as much room as possible"
            onClick={() => useDialogStore.getState().show('arrange')}
          >
            <Icon name="nest" size={16} /> Arrange on stock
          </button>
        </div>
      )}
    </section>
  );
}

/** What to do first, while there's nothing to cut yet. */
function GettingStarted({ hasShapes }: { hasShapes: boolean }) {
  const openStock = () => useDialogStore.getState().show('stock');
  return (
    <ol className="getting-started">
      <li>
        Set your stock: size and material, with the{' '}
        <button type="button" className="link-button" onClick={openStock}>
          stock button
        </button>{' '}
        at the top.
      </li>
      <li className={hasShapes ? 'done' : undefined}>
        Draw or import a design with the tools on the left.
      </li>
      <li>
        Select a shape and pick <b>Add a cut</b>: engrave it, cut it out, clear the inside…
      </li>
      <li>Check the preview and 3D view, then Export.</li>
    </ol>
  );
}
