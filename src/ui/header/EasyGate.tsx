import { toolpathGroups } from '../../core/job/toolpaths';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { Icon } from '../icons/Icon';

/**
 * Covers the workspace in Easy when the job uses more than Easy can show
 * (a second bit, or a second cut on one shape). Nothing is changed or lost.
 */
export function EasyGate() {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const jobName = useJobStore((s) => s.jobName);
  const setMode = useModeStore((s) => s.setMode);
  const bitCount = toolpathGroups(toolpaths).length;

  return (
    <div className="easy-gate">
      <div className="easy-gate-card" role="dialog" aria-labelledby="easy-gate-title">
        <h2 id="easy-gate-title">
          <Icon name="lock" size={18} /> This job needs Pro mode
        </h2>
        <p>
          {jobName ? `“${jobName}”` : 'This job'} uses {bitCount} {bitCount === 1 ? 'bit' : 'bits'}{' '}
          and {toolpaths.length} toolpaths. Easy mode handles one bit and one cut per shape, so it
          shows this job read-only. Nothing has been changed.
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
