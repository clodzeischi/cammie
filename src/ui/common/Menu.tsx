import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../icons/Icon';

interface PopoverMenuProps {
  /** Screen position of the menu's top-left corner; it's kept inside the window. */
  x: number;
  y: number;
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** The button that opened it: pressing it again toggles the menu rather than reopening it. */
  anchorRef?: RefObject<HTMLElement | null>;
}

/** Keeps this many px between a menu and the window's edge. */
const EDGE = 8;

/**
 * A floating list of commands. Closes on Escape, on a press outside it, and
 * after any item is picked. Rendered into <body> so it sits above the canvas.
 */
export function PopoverMenu({ x, y, label, onClose, children, anchorRef }: PopoverMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      x: Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE)),
      y: Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPress = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchorRef?.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPress);
    };
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      aria-label={label}
      style={{ left: position.x, top: position.y }}
      onClick={(e) => (e.target as HTMLElement).closest('[role="menuitem"]') && onClose()}
    >
      {children}
    </div>,
    document.body,
  );
}

interface MenuItemProps {
  label: string;
  /** A second, quieter line (what it does, or the technical term). */
  detail?: string;
  icon?: IconName;
  /** CSS colour for the icon. */
  iconColor?: string;
  /** Shortcut shown on the right, e.g. "⌘C". */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

export function MenuItem(props: MenuItemProps) {
  const { label, detail, icon, iconColor, shortcut, disabled, danger, onClick } = props;
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? 'menu-item menu-item-danger' : 'menu-item'}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && (
        <span className="menu-item-icon" style={iconColor ? { color: iconColor } : undefined}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="menu-item-text">
        <span>{label}</span>
        {detail && <small>{detail}</small>}
      </span>
      {shortcut && <kbd className="menu-item-shortcut">{shortcut}</kbd>}
    </button>
  );
}

export const MenuDivider = () => <hr className="menu-divider" />;
export const MenuHeading = ({ children }: { children: ReactNode }) => (
  <div className="menu-heading">{children}</div>
);

interface MenuButtonProps {
  /** The button's own content. */
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
  menuLabel: string;
  /** Opens to the left edge of the button (default) or lines up with its right edge. */
  align?: 'left' | 'right';
  items: ReactNode;
}

/** A button that opens a menu under itself. */
export function MenuButton(props: MenuButtonProps) {
  const { children, className, title, ariaLabel, menuLabel, align = 'left', items } = props;
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    // A right-aligned menu starts far right; PopoverMenu pulls it back inside the window.
    setAt({ x: align === 'left' ? box.left : box.right - 240, y: box.bottom + 4 });
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={at !== null}
        onClick={() => (at ? setAt(null) : open())}
      >
        {children}
      </button>
      {at && (
        <PopoverMenu
          x={at.x}
          y={at.y}
          label={menuLabel}
          anchorRef={ref}
          onClose={() => setAt(null)}
        >
          {items}
        </PopoverMenu>
      )}
    </>
  );
}
