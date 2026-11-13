import { useDialogStore } from '../../state/dialogStore';
import { MenuButton, MenuItem } from '../common/Menu';
import { Icon } from '../icons/Icon';

/** Settings you set once and rarely change: the machine and the bit library. */
export function SettingsMenu() {
  const show = useDialogStore((s) => s.show);
  return (
    <MenuButton
      className="button icon-only"
      title="Machine and bits"
      ariaLabel="Settings"
      menuLabel="Settings"
      align="right"
      items={
        <>
          <MenuItem icon="machine" label="Machine…" onClick={() => show('machine')} />
          <MenuItem icon="bits" label="Bits…" onClick={() => show('bits')} />
        </>
      }
    >
      <Icon name="settings" size={18} />
    </MenuButton>
  );
}
