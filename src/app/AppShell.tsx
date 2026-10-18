import { useState } from 'react';
import { hasErrors } from '../core/cam/program';
import { grblPost } from '../core/post/grbl/grblPost';
import { useJobStore } from '../state/jobStore';
import { useMachineStore } from '../state/machineStore';
import { useGeneratedJob, useJob } from '../state/useGeneratedJob';
import { MachineSettingsDialog } from '../ui/panels/MachineSettingsDialog';
import { Sidebar } from '../ui/panels/Sidebar';
import { ImportImageButton } from '../ui/toolbar/ImportImageButton';
import { Workspace } from '../ui/Workspace';
import { buildExportFiles, downloadFiles } from './exportFiles';
import { useAppShortcuts } from './useAppShortcuts';

export function AppShell() {
  const [machineOpen, setMachineOpen] = useState(false);
  const jobName = useJobStore((s) => s.jobName);
  const setJobName = useJobStore((s) => s.setJobName);
  const machine = useMachineStore((s) => s.config);
  const job = useJob();
  const generated = useGeneratedJob();
  useAppShortcuts();

  const blocked = hasErrors(generated.diagnostics) || generated.programs.length === 0;
  const exportJob = () =>
    downloadFiles(buildExportFiles(generated.programs, job, machine, jobName, grblPost));
  const fileCount = generated.programs.length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-name">
          <img src="/Cammie_Logo.png" alt="" className="app-logo" />
          Cammie
        </span>
        <input
          className="job-name"
          aria-label="Job name"
          placeholder="Untitled job"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
        />
        <div className="app-header-actions">
          <button type="button" className="button" onClick={() => setMachineOpen(true)}>
            ⚙ Machine
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={blocked}
            title={blocked ? 'Fix the items under Checks first' : undefined}
            onClick={exportJob}
          >
            Export{fileCount > 1 ? ` ${fileCount} files` : ''}
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="toolbar" aria-label="Tools">
          <ImportImageButton />
        </nav>
        <Workspace />
        <Sidebar />
      </div>

      {machineOpen && <MachineSettingsDialog onClose={() => setMachineOpen(false)} />}
    </div>
  );
}
