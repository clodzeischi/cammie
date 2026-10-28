import type { KeyboardEvent, PointerEvent } from 'react';

interface SplitDividerProps {
  /** Share of the parent's width taken by the pane on the divider's right. */
  share: number;
  onChange: (share: number) => void;
  label: string;
}

/** Arrow keys move the divider this share of the width. */
const KEY_STEP = 0.05;

/** A draggable (and keyboard-movable) line between two side-by-side panes. */
export function SplitDivider({ share, onChange, label }: SplitDividerProps) {
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const parent = e.currentTarget.parentElement;
    if (!parent) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = parent.getBoundingClientRect();
    const move = (ev: globalThis.PointerEvent) => onChange((box.right - ev.clientX) / box.width);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onChange(share + KEY_STEP);
    else if (e.key === 'ArrowRight') onChange(share - KEY_STEP);
    else return;
    // Keep the canvas's arrow-key nudging from also firing.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="split-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(share * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
