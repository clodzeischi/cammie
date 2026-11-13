import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons/Icon';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The dialog's action (e.g. "Add hole"). Leave out for dialogs that apply changes as they're made. */
  footer?: ReactNode;
  /** Room for side-by-side content such as the trace preview. */
  wide?: boolean;
}

/**
 * Centered modal panel. Escape or clicking the backdrop closes it. Rendered
 * into <body> so it always sits above the canvas, wherever it's used from.
 */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={wide ? 'modal modal-wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            title="Close (Esc)"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
