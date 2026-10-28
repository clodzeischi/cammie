import { cutKindOf } from '../../core/job/objectFactory';
import { toolpathsOf } from '../../core/job/toolpaths';
import { findBit } from '../../core/tools/bits';
import { addCutToSelection } from '../../state/cutActions';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { CUT_KIND_ORDER, CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';

interface ObjectToolpathsProps {
  /** One object: its toolpaths are listed. Several: only the add buttons. */
  objectId?: string;
}

/** Pro: the selected object's toolpaths, and buttons to add more. */
export function ObjectToolpaths({ objectId }: ObjectToolpathsProps) {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const bits = useToolingStore((s) => s.bits);
  const own = objectId ? toolpathsOf(toolpaths, objectId) : [];

  return (
    <fieldset>
      <legend>Toolpaths</legend>
      {objectId && own.length === 0 && (
        <p className="muted small">Not cut yet. Add a toolpath below.</p>
      )}
      {own.length > 0 && (
        <ul className="object-toolpaths">
          {own.map((t) => {
            const kind = CUT_KINDS[cutKindOf(t.operation)];
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="toolpath-chip"
                  onClick={() => selectToolpath(t.id)}
                >
                  <span style={{ color: kind.color }}>
                    <Icon name={kind.icon} size={18} />
                  </span>
                  <span>{kind.pro}</span>
                  <span className="muted small">
                    {findBit(t.operation.bitId, bits)?.name ?? 'Missing bit'} · {t.operation.depth}{' '}
                    mm
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="add-cut-buttons" role="group" aria-label="Add a toolpath">
        {CUT_KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className="button button-small"
            onClick={() => addCutToSelection(k)}
          >
            + {CUT_KINDS[k].pro}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
