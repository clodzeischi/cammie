import { useDialogStore } from '../../state/dialogStore';
import { MenuButton, MenuItem } from '../common/Menu';
import { Icon } from '../icons/Icon';

/** Settings you set once and rarely change: the machine and the bit library. */
export function SettingsMenu() {
  const show = useDialogStore((s) => s.show);
  return (
    <MenuButton
      className="button"
      title="Machine and bits"
      ariaLabel="Settings"
      menuLabel="Settings"
      align="right"
      items={
        <>
          <MenuItem
            icon="machine"
            label="Machine…"
            detail="Work area, speeds, spindle, G-code"
            onClick={() => show('machine')}
          />
          <MenuItem
            icon="bits"
            label="Bits…"
            detail="Built-in bits and your own"
            onClick={() => show('bits')}
          />
        </>
      }
    >
      <Icon name="settings" size={16} />
    </MenuButton>
  );
}
