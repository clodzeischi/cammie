import { faceOf } from '../../core/job/faces';
import type { Toolpath } from '../../core/job/job';
import { cutKindOf } from '../../core/job/objectFactory';
import { EASY_CUT_KINDS } from '../../core/job/toolpaths';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { Icon } from '../icons/Icon';

/** What in the job needs Pro, as short phrases ("uses 2 bits", …). */
function proReasons(toolpaths: readonly Toolpath[]): string[] {
  const bits = new Set(toolpaths.map((t) => t.operation.bitId)).size;
  const shapes = new Set(toolpaths.map((t) => t.objectId)).size;
  return [
    bits > 1 && `uses ${bits} bits`,
    shapes < toolpaths.length && 'has more than one cut on a shape',
    toolpaths.some((t) => !EASY_CUT_KINDS.includes(cutKindOf(t.operation))) &&
      'has chamfers or drilling',
    toolpaths.some((t) => faceOf(t) === 'bottom') && 'cuts both sides of the stock',
  ].filter((r): r is string => typeof r === 'string');
}

const joinAnd = (items: string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Covers the workspace in Easy when the job uses more than Easy can show
 * (see fitsEasyMode). Nothing is changed or lost.
 */
export function EasyGate() {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const jobName = useJobStore((s) => s.jobName);
  const setMode = useModeStore((s) => s.setMode);
  const reasons = proReasons(toolpaths);

  return (
    <div className="easy-gate">
      <div className="easy-gate-card" role="dialog" aria-labelledby="easy-gate-title">
        <h2 id="easy-gate-title">
          <Icon name="lock" size={18} /> This job needs Pro mode
        </h2>
        <p>
          {jobName ? `“${jobName}”` : 'This job'} {joinAnd(reasons)}. Easy mode handles one bit, one
          plain cut per shape and the top side only, so it shows this job read-only. Nothing has
          been changed.
        </p>
        <div>
          <button type="button" className="button button-primary" onClick={() => setMode('pro')}>
            Switch to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
