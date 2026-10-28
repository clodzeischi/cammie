import type { Toolpath } from '../../core/job/job';
import { cutKindOf } from '../../core/job/objectFactory';
import { findBit } from '../../core/tools/bits';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';
import { CutFields } from './CutFields';
import { describeCut } from './describeCut';

interface ToolpathPanelProps {
  toolpath: Toolpath;
}

/** Pro: settings for the toolpath picked in the list. */
export function ToolpathPanel({ toolpath }: ToolpathPanelProps) {
  const object = useJobStore((s) => s.objects.find((o) => o.id === toolpath.objectId));
  const thickness = useJobStore((s) => s.stock.thickness);
  const updateToolpath = useJobStore((s) => s.updateToolpath);
  const removeToolpaths = useJobStore((s) => s.removeToolpaths);
  const select = useJobStore((s) => s.select);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const bits = useToolingStore((s) => s.bits);
  const { operation } = toolpath;
  const kind = CUT_KINDS[cutKindOf(operation)];
  const name = object?.name ?? 'object';

  return (
    <section className="panel" aria-label="Toolpath">
      <div className="panel-heading">
        <button type="button" className="link-button" onClick={() => selectToolpath(null)}>
          ← Job
        </button>
        <div className="panel-title-row">
          <span className="cut-badge" style={{ color: kind.color }}>
            <Icon name={kind.icon} size={22} />
          </span>
          <div className="panel-title-text">
            <h2 className="panel-title">{kind.pro}</h2>
            <span className="muted small">{name}</span>
          </div>
        </div>
      </div>
      <p className="cut-says">
        {describeCut(operation, findBit(operation.bitId, bits), name, thickness)}
      </p>
      <div className="applies-to small">
        <span className="muted">Applies to</span>
        <button type="button" className="chip" onClick={() => select(toolpath.objectId)}>
          {name}
        </button>
      </div>
      <CutFields
        operation={operation}
        onChange={(next, kindChanged) => updateToolpath(toolpath.id, next, kindChanged)}
        onRemove={() => removeToolpaths([toolpath.id])}
      />
    </section>
  );
}
