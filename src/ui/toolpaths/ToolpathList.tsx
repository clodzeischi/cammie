import type { Diagnostic } from '../../core/cam/program';
import { cutKindOf } from '../../core/job/objectFactory';
import { FLIP_LABEL } from '../../core/job/faces';
import { moveGroup, moveToolpath, toolpathGroups } from '../../core/job/toolpaths';
import { bitDetail, findBit } from '../../core/tools/bits';
import { useJobStore } from '../../state/jobStore';
import { useGeneratedJob } from '../../state/useGeneratedJob';
import { useToolingStore } from '../../state/toolingStore';
import { useActiveSide } from '../../state/useActiveSide';
import { bitIcon } from '../bitIcons';
import { CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';

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
 * Pro: the whole plan, top to bottom in cut order. Each bit is one file; the
 * steps between files say what to do at the machine.
 */
export function ToolpathList() {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const objects = useJobStore((s) => s.objects);
  const selectedId = useJobStore((s) => s.selectedToolpathId);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const setToolpaths = useJobStore((s) => s.setToolpaths);
  const removeToolpaths = useJobStore((s) => s.removeToolpaths);
  const flip = useJobStore((s) => s.flip);
  const setSideView = useJobStore((s) => s.setSideView);
  const side = useActiveSide();
  const bits = useToolingStore((s) => s.bits);
  const { diagnostics } = useGeneratedJob();
  const problems = severities(diagnostics);
  const groups = toolpathGroups(toolpaths);
  const twoSided = groups.some((g) => g.face === 'bottom');
  const hiddenFiles = groups.filter((g) => side !== 'both' && g.face !== side).length;
  const nameOf = (id: string) => objects.find((o) => o.id === id)?.name ?? 'Missing object';

  return (
    <aside className="toolpath-pane" aria-label="Toolpaths">
      <div className="pane-head">
        <h2 className="pane-title">Toolpaths</h2>
        {groups.length > 0 && (
          <span className="muted small">
            {groups.length} {groups.length === 1 ? 'file' : 'files'}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="pane-hint">
          Nothing is cut yet. Select shapes on the canvas, then pick a cut in the <b>Toolpaths</b>{' '}
          tab.
        </p>
      ) : (
        <ol className="toolpath-groups">
          {groups.map((group, gi) => {
            // Hidden while working on the other side; numbering still counts it.
            if (side !== 'both' && group.face !== side) return null;
            const bit = findBit(group.bitId, bits);
            const previous = groups[gi - 1];
            const flipsHere = previous !== undefined && previous.face !== group.face;
            const sameFace = (other: (typeof groups)[number] | undefined) =>
              other !== undefined && other.face === group.face;
            return (
              <li key={`${group.face}|${group.bitId}`} className="toolpath-group">
                {twoSided && (gi === 0 || flipsHere) && (
                  <h3 className="toolpath-face">
                    {group.face === 'top' ? 'Top side' : 'Bottom side'}
                  </h3>
                )}
                {flipsHere && (
                  <div className="toolpath-step toolpath-step-flip">
                    <Icon name="flip" size={16} />
                    <span>
                      <b>Turn the stock over</b> {FLIP_LABEL[flip]} onto the registration pins
                      {previous.bitId === group.bitId
                        ? ', then re-zero Z only'
                        : `, change bit to ${bit?.name ?? 'the next bit'}, then re-zero Z only`}
                      . Keep X/Y zero where it is: the pins line the stock up with it.
                    </span>
                  </div>
                )}
                {gi > 0 && !flipsHere && (
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
                        disabled={!sameFace(previous)}
                        onClick={() =>
                          setToolpaths(moveGroup(toolpaths, group.face, group.bitId, -1))
                        }
                      >
                        <Icon name="chevronUp" size={14} />
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        aria-label={`Run ${bit?.name ?? 'this bit'} later`}
                        title="Run this file later"
                        disabled={!sameFace(groups[gi + 1])}
                        onClick={() =>
                          setToolpaths(moveGroup(toolpaths, group.face, group.bitId, 1))
                        }
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
                            <small>{kind.pro}</small>
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
                            aria-label={`Move ${kind.pro} on ${name} up`}
                            disabled={ti === 0}
                            onClick={() => setToolpaths(moveToolpath(toolpaths, t.id, -1))}
                          >
                            <Icon name="chevronUp" size={14} />
                          </button>
                          <button
                            type="button"
                            className="mini-button"
                            aria-label={`Move ${kind.pro} on ${name} down`}
                            disabled={ti === group.toolpaths.length - 1}
                            onClick={() => setToolpaths(moveToolpath(toolpaths, t.id, 1))}
                          >
                            <Icon name="chevronDown" size={14} />
                          </button>
                          <button
                            type="button"
                            className="mini-button"
                            aria-label={`Delete ${kind.pro} on ${name}`}
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
      {hiddenFiles > 0 && (
        <p className="pane-hint">
          {side === 'top' ? 'Bottom' : 'Top'} side hidden ({hiddenFiles}{' '}
          {hiddenFiles === 1 ? 'file' : 'files'}).{' '}
          <button type="button" className="link-button" onClick={() => setSideView('both')}>
            Show both sides
          </button>
        </p>
      )}
      {groups.length > 0 && (
        <p className="pane-hint">
          Top to bottom is the cut order. Each bit is one file. New cuts go where they're safest:
          pockets and holes first, cut-outs last.
        </p>
      )}
    </aside>
  );
}
