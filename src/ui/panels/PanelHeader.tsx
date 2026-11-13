import type { ReactNode } from 'react';
import { arrange, canGroup, canUngroup } from '../../state/arrangeActions';
import { useJobStore } from '../../state/jobStore';
import { MOD_KEY } from '../common/platform';
import { Icon, type IconName } from '../icons/Icon';

interface PanelHeaderProps {
  title: string;
  actions?: ReactNode;
}

/** The inspector's title row: what's selected, its actions, and × to go back to the cut plan. */
export function PanelHeader({ title, actions }: PanelHeaderProps) {
  const select = useJobStore((s) => s.select);
  return (
    <div className="panel-header">
      <h2 className="panel-title" title={title}>
        {title}
      </h2>
      <div className="panel-actions">
        {actions}
        <IconAction icon="close" label="Close (Esc)" onClick={() => select(null)} />
      </div>
    </div>
  );
}

interface IconActionProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function IconAction({ icon, label, onClick, danger }: IconActionProps) {
  return (
    <button
      type="button"
      className={danger ? 'icon-button icon-button-danger' : 'icon-button'}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/** Duplicate, group or ungroup, and delete: the commands for whatever is selected. */
export function SelectionActions() {
  // Plain booleans so the selector result is stable between renders.
  const groupable = useJobStore((s) => canGroup(s));
  const grouped = useJobStore((s) => canUngroup(s));
  return (
    <>
      <IconAction icon="duplicate" label={`Duplicate (${MOD_KEY}D)`} onClick={arrange.duplicate} />
      {groupable && (
        <IconAction icon="group" label={`Group (${MOD_KEY}G)`} onClick={arrange.group} />
      )}
      {grouped && (
        <IconAction icon="ungroup" label={`Ungroup (${MOD_KEY}⇧G)`} onClick={arrange.ungroup} />
      )}
      <IconAction icon="trash" label="Delete (⌫)" danger onClick={arrange.remove} />
    </>
  );
}
