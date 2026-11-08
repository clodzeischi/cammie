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

/**
 * Settings for one cut, picked from the cut plan or its shape. "← shape"
 * goes back to the shape it belongs to; Done there goes back to the plan.
 */
export function ToolpathPanel({ toolpath }: ToolpathPanelProps) {
  const object = useJobStore((s) => s.objects.find((o) => o.id === toolpath.objectId));
  const thickness = useJobStore((s) => s.stock.thickness);
  const updateToolpath = useJobStore((s) => s.updateToolpath);
  const removeToolpaths = useJobStore((s) => s.removeToolpaths);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const bits = useToolingStore((s) => s.bits);
  const { operation } = toolpath;
  const kind = CUT_KINDS[cutKindOf(operation)];
  const name = object?.name ?? 'shape';

  return (
    <section className="panel" aria-label="Cut">
      <div className="panel-heading">
        <button
          type="button"
          className="link-button"
          title={`Back to ${name}`}
          onClick={() => selectToolpath(null)}
        >
          ← {name}
        </button>
        <div className="panel-title-row">
          <span className="cut-badge" style={{ color: kind.color }}>
            <Icon name={kind.icon} size={22} />
          </span>
          <div className="panel-title-text">
            <h2 className="panel-title">{kind.name}</h2>
            <span className="muted small">
              {kind.term} · {name}
            </span>
          </div>
        </div>
      </div>
      <p className="cut-says">
        {describeCut(operation, findBit(operation.bitId, bits), name, thickness)}
      </p>
      <CutFields
        toolpathId={toolpath.id}
        operation={operation}
        onChange={(next, kindChanged) => updateToolpath(toolpath.id, next, kindChanged)}
        onRemove={() => removeToolpaths([toolpath.id])}
      />
    </section>
  );
}
