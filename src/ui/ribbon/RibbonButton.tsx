import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';

interface RibbonButtonProps {
  icon: IconName;
  label: string;
  title?: string;
  disabled?: boolean;
  /** Shown pressed, e.g. Simulate while the preview is open. */
  active?: boolean;
  onClick: () => void;
}

/** An icon with its name underneath: labels make tools findable the first time. */
export function RibbonButton({ icon, label, title, disabled, active, onClick }: RibbonButtonProps) {
  return (
    <button
      type="button"
      className="ribbon-button"
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon name={icon} size={22} />
      <span className="ribbon-label">{label}</span>
    </button>
  );
}

interface RibbonGroupProps {
  label: string;
  children: ReactNode;
}

export function RibbonGroup({ label, children }: RibbonGroupProps) {
  return (
    <div className="ribbon-group" role="group" aria-label={label}>
      <div className="ribbon-buttons">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </div>
  );
}
