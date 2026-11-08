import { useDialogStore } from '../state/dialogStore';
import { useJobStore } from '../state/jobStore';
import { useNoticeStore } from '../state/noticeStore';
import { Toast } from '../ui/common/Toast';
import { ExportButton } from '../ui/header/ExportButton';
import { HistoryButtons } from '../ui/header/HistoryButtons';
import { ProjectButtons } from '../ui/header/ProjectButtons';
import { SettingsMenu } from '../ui/header/SettingsMenu';
import { StockButton } from '../ui/header/StockButton';
import { ArrangeDialog } from '../ui/panels/ArrangeDialog';
import { BitLibraryDialog } from '../ui/panels/BitLibraryDialog';
import { HoleDialog } from '../ui/panels/HoleDialog';
import { MachineSettingsDialog } from '../ui/panels/MachineSettingsDialog';
import { Sidebar } from '../ui/panels/Sidebar';
import { StockDialog } from '../ui/panels/StockDialog';
import { ToolRail } from '../ui/toolbar/ToolRail';
import { Workspace } from '../ui/Workspace';
import { useAppShortcuts } from './useAppShortcuts';
import { useProjectBackup } from './useProjectBackup';

/**
 * The screen, left to right in the order of the work: job settings and
 * export along the top, tools on the left, the canvas, and one panel on the
 * right (the cut plan, or whatever is selected).
 */
export function AppShell() {
  const jobName = useJobStore((s) => s.jobName);
  const setJobName = useJobStore((s) => s.setJobName);
  useAppShortcuts();
  const restored = useProjectBackup();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-name">
          <img src="/Cammie_Logo.png" alt="" className="app-logo" />
          <span className="app-name-text">Cammie</span>
        </span>
        <input
          className="job-name"
          aria-label="Job name"
          placeholder="Untitled job"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
        />
        <StockButton />
        <div className="app-header-actions">
          <HistoryButtons />
          <ProjectButtons notice={restored} />
          <SettingsMenu />
          <ExportButton />
        </div>
      </header>

      <div className="app-body">
        <ToolRail />
        <Workspace />
        <Sidebar />
      </div>

      <Dialogs />
      <Notice />
    </div>
  );
}

function Dialogs() {
  const open = useDialogStore((s) => s.open);
  const close = useDialogStore((s) => s.close);
  switch (open) {
    case 'stock':
      return <StockDialog onClose={close} />;
    case 'machine':
      return <MachineSettingsDialog onClose={close} />;
    case 'bits':
      return <BitLibraryDialog onClose={close} />;
    case 'hole':
      return <HoleDialog onClose={close} />;
    case 'arrange':
      return <ArrangeDialog onClose={close} />;
    case null:
      return null;
  }
}

function Notice() {
  const notice = useNoticeStore((s) => s.notice);
  const dismiss = useNoticeStore((s) => s.dismiss);
  return notice ? <Toast message={notice} onDismiss={dismiss} /> : null;
}
