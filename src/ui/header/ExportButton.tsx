import { hasErrors } from '../../core/cam/program';
import { grblPost } from '../../core/post/grbl/grblPost';
import { buildExportFiles, downloadFiles } from '../../app/exportFiles';
import { useJobStore } from '../../state/jobStore';
import { useMachineStore } from '../../state/machineStore';
import { useGeneratedJob, useJob } from '../../state/useGeneratedJob';
import { Icon } from '../icons/Icon';

/**
 * Downloads the G-code. It shows how the checks stand: a red count of
 * problems that block export, or an amber count of warnings to look at.
 */
export function ExportButton() {
  const jobName = useJobStore((s) => s.jobName);
  const machine = useMachineStore((s) => s.config);
  const job = useJob();
  const generated = useGeneratedJob();
  // An empty job isn't a problem yet: the cut plan's getting-started steps say what to do.
  const empty = useJobStore((s) => s.objects.length === 0);
  const errors = generated.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = generated.diagnostics.length - errors;
  const fileCount = generated.programs.length;
  const blocked = hasErrors(generated.diagnostics) || fileCount === 0;

  const title = blocked
    ? `Fix ${errors === 1 ? 'the problem' : `the ${errors} problems`} under Checks in the cut plan first`
    : warnings > 0
      ? `${warnings} ${warnings === 1 ? 'warning' : 'warnings'} under Checks in the cut plan`
      : 'Download the G-code';
  return (
    <button
      type="button"
      className="button button-primary export-button"
      disabled={blocked}
      title={title}
      onClick={() =>
        downloadFiles(
          buildExportFiles(generated.programs, job, machine, jobName, grblPost),
          jobName,
        )
      }
    >
      <Icon name="export" size={16} /> Export
      {fileCount > 1 ? ` ${fileCount} files (.zip)` : ''}
      {!empty && (errors > 0 || warnings > 0) && (
        <span
          className={errors > 0 ? 'export-badge export-badge-error' : 'export-badge'}
          aria-label={errors > 0 ? `${errors} problems` : `${warnings} warnings`}
        >
          {errors > 0 ? errors : warnings}
        </span>
      )}
    </button>
  );
}
