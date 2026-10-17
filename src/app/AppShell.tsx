import { useState } from 'react';
import { MachineSettingsDialog } from '../ui/panels/MachineSettingsDialog';

export function AppShell() {
  const [machineOpen, setMachineOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-name">Cammie</span>
        <div className="app-header-actions">
          <button type="button" className="button" onClick={() => setMachineOpen(true)}>
            ⚙ Machine
          </button>
          <button type="button" className="button button-primary" disabled>
            Export
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="workspace-empty">
          <p>Nothing here yet.</p>
          <p className="muted">PNG import and V-bit engraving arrive in phase 1.</p>
        </div>
      </main>

      {machineOpen && <MachineSettingsDialog onClose={() => setMachineOpen(false)} />}
    </div>
  );
}
