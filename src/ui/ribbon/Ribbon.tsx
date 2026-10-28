import { useState } from 'react';
import { addCutToSelection } from '../../state/cutActions';
import { arrange, canGroup, canUngroup } from '../../state/arrangeActions';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { addRegistrationHoles } from '../../state/twoSidedActions';
import { MOD_KEY } from '../common/platform';
import { CUT_KIND_ORDER, CUT_KINDS } from '../cutKinds';
import { DrawTools } from '../toolbar/DrawTools';
import { HistoryButtons } from '../toolbar/HistoryButtons';
import { ImportButton } from '../toolbar/ImportButton';
import { RibbonButton, RibbonGroup } from './RibbonButton';

type Tab = 'design' | 'toolpaths' | 'setup';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'design', label: 'Shapes' },
  { id: 'toolpaths', label: 'Toolpaths' },
  { id: 'setup', label: 'Setup' },
];

interface RibbonProps {
  onOpenBits: () => void;
  onOpenMachine: () => void;
}

/**
 * Commands along the top, in the same button style in both modes. Pro groups
 * them into Shapes, Toolpaths and Setup tabs; Easy shows just the drawing
 * tools, with material and bit in the header.
 */
export function Ribbon({ onOpenBits, onOpenMachine }: RibbonProps) {
  const mode = useModeStore((s) => s.mode);
  const [tab, setTab] = useState<Tab>('design');

  if (mode === 'easy') {
    return (
      <nav className="ribbon" aria-label="Tools">
        <div className="ribbon-body">
          <RibbonGroup label="Add">
            <ImportButton />
            <DrawTools />
          </RibbonGroup>
          <RibbonGroup label="History">
            <HistoryButtons />
          </RibbonGroup>
        </div>
      </nav>
    );
  }

  return (
    <nav className="ribbon" aria-label="Tools">
      <div className="ribbon-tabs" role="tablist" aria-label="Tool groups">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ribbon-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="ribbon-panel"
            className="ribbon-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="ribbon-body"
        id="ribbon-panel"
        role="tabpanel"
        aria-labelledby={`ribbon-tab-${tab}`}
      >
        {tab === 'design' && <DesignTab />}
        {tab === 'toolpaths' && <ToolpathsTab />}
        {tab === 'setup' && <SetupTab onOpenBits={onOpenBits} onOpenMachine={onOpenMachine} />}
      </div>
    </nav>
  );
}

function DesignTab() {
  const hasSelection = useJobStore((s) => s.selectedIds.length > 0);
  const groupable = useJobStore((s) => canGroup(s));
  const grouped = useJobStore((s) => canUngroup(s));
  return (
    <>
      <RibbonGroup label="Add">
        <ImportButton />
        <DrawTools />
      </RibbonGroup>
      <RibbonGroup label="Arrange">
        <RibbonButton
          icon="duplicate"
          label="Duplicate"
          title={`Duplicate (${MOD_KEY}D)`}
          disabled={!hasSelection}
          onClick={arrange.duplicate}
        />
        <RibbonButton
          icon="group"
          label="Group"
          title={`Group (${MOD_KEY}G)`}
          disabled={!groupable}
          onClick={arrange.group}
        />
        <RibbonButton
          icon="ungroup"
          label="Ungroup"
          title={`Ungroup (${MOD_KEY}⇧G)`}
          disabled={!grouped}
          onClick={arrange.ungroup}
        />
        <RibbonButton
          icon="trash"
          label="Delete"
          title="Delete the selected shapes"
          disabled={!hasSelection}
          onClick={arrange.remove}
        />
      </RibbonGroup>
      <RibbonGroup label="History">
        <HistoryButtons />
      </RibbonGroup>
    </>
  );
}

function ToolpathsTab() {
  const hasSelection = useJobStore((s) => s.selectedIds.length > 0);
  const view = useJobStore((s) => s.view);
  const setView = useJobStore((s) => s.setView);
  return (
    <>
      <RibbonGroup label="Cut">
        {CUT_KIND_ORDER.map((k) => (
          <RibbonButton
            key={k}
            icon={CUT_KINDS[k].icon}
            label={CUT_KINDS[k].pro}
            title={
              hasSelection
                ? `${CUT_KINDS[k].hint} (adds a toolpath to the selected shapes)`
                : 'Select shapes on the canvas first'
            }
            disabled={!hasSelection}
            onClick={() => addCutToSelection(k)}
          />
        ))}
      </RibbonGroup>
      <RibbonGroup label="Two-sided">
        <RibbonButton
          icon="flip"
          label="Registration holes"
          title="Dowel-pin holes on the flip line, so the stock goes back in place after turning it over"
          onClick={() => addRegistrationHoles()}
        />
      </RibbonGroup>
      <RibbonGroup label="Check">
        <RibbonButton
          icon="preview"
          label="Simulate"
          title="Show the toolpaths and play them back"
          active={view === 'preview'}
          onClick={() => setView(view === 'preview' ? 'design' : 'preview')}
        />
      </RibbonGroup>
    </>
  );
}

function SetupTab({ onOpenBits, onOpenMachine }: RibbonProps) {
  const select = useJobStore((s) => s.select);
  const setView = useJobStore((s) => s.setView);
  return (
    <>
      <RibbonGroup label="This job">
        <RibbonButton
          icon="stock"
          label="Stock & material"
          title="Stock size, material and origin (in the side panel)"
          onClick={() => {
            setView('design');
            select(null);
          }}
        />
      </RibbonGroup>
      <RibbonGroup label="Libraries">
        <RibbonButton
          icon="bits"
          label="Bits"
          title="Built-in and custom bits"
          onClick={onOpenBits}
        />
      </RibbonGroup>
      <RibbonGroup label="Machine">
        <RibbonButton
          icon="machine"
          label="Machine"
          title="Work area, speeds and G-code settings"
          onClick={onOpenMachine}
        />
      </RibbonGroup>
    </>
  );
}
