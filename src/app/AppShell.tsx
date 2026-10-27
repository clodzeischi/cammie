import { useState } from 'react';
import { hasErrors } from '../core/cam/program';
import { fitsEasyMode } from '../core/job/toolpaths';
import { grblPost } from '../core/post/grbl/grblPost';
import { useJobStore } from '../state/jobStore';
import { useMachineStore } from '../state/machineStore';
import { useModeStore } from '../state/modeStore';
import { useGeneratedJob, useJob } from '../state/useGeneratedJob';
import { EasyGate } from '../ui/header/EasyGate';
import { EasyJobPickers } from '../ui/header/EasyJobPickers';
import { ModeSwitch } from '../ui/header/ModeSwitch';
import { ProjectButtons } from '../ui/header/ProjectButtons';
import { Icon } from '../ui/icons/Icon';
import { BitLibraryDialog } from '../ui/panels/BitLibraryDialog';
import { MachineSettingsDialog } from '../ui/panels/MachineSettingsDialog';
import { Sidebar } from '../ui/panels/Sidebar';
import { Ribbon } from '../ui/ribbon/Ribbon';
import { ToolpathList } from '../ui/toolpaths/ToolpathList';
import { Workspace } from '../ui/Workspace';
import { buildExportFiles, downloadFiles } from './exportFiles';
import { useAppShortcuts } from './useAppShortcuts';
import { useProjectBackup } from './useProjectBackup';

export function AppShell() {
  const [machineOpen, setMachineOpen] = useState(false);
  const [bitsOpen, setBitsOpen] = useState(false);
  const jobName = useJobStore((s) => s.jobName);
  const setJobName = useJobStore((s) => s.setJobName);
  const machine = useMachineStore((s) => s.config);
  const mode = useModeStore((s) => s.mode);
  const job = useJob();
  const generated = useGeneratedJob();
  useAppShortcuts();
  const restored = useProjectBackup();

  const easy = mode === 'easy';
  const gated = easy && !fitsEasyMode(job);
  const blocked = hasErrors(generated.diagnostics) || generated.programs.length === 0;
  const exportJob = () =>
    downloadFiles(buildExportFiles(generated.programs, job, machine, jobName, grblPost), jobName);
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
        {easy && !gated && <EasyJobPickers />}
        <div className="app-header-actions">
          <ProjectButtons notice={restored} />
          <ModeSwitch />
          {easy && (
            <button type="button" className="button" onClick={() => setMachineOpen(true)}>
              <Icon name="machine" size={16} /> Machine
            </button>
          )}
          <button
            type="button"
            className="button button-primary"
            disabled={blocked}
            title={blocked ? 'Fix the items under Checks first' : undefined}
            onClick={exportJob}
          >
            <Icon name="export" size={16} /> Export
            {fileCount > 1 ? ` ${fileCount} files (.zip)` : ''}
          </button>
        </div>
      </header>

      {!gated && (
        <Ribbon onOpenBits={() => setBitsOpen(true)} onOpenMachine={() => setMachineOpen(true)} />
      )}

      <div className={easy ? 'app-body app-body-easy' : 'app-body app-body-pro'}>
        {!easy && <ToolpathList />}
        <Workspace />
        <Sidebar />
        {gated && <EasyGate />}
      </div>

      {machineOpen && <MachineSettingsDialog onClose={() => setMachineOpen(false)} />}
      {bitsOpen && <BitLibraryDialog onClose={() => setBitsOpen(false)} />}
    </div>
  );
}
