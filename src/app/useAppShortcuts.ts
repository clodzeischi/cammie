import { useEffect } from 'react';
import { arrange } from '../state/arrangeActions';
import { useJobStore } from '../state/jobStore';
import { IS_MAC } from '../ui/common/platform';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Arrow keys move the selection this far (mm); with Shift, ten times as far. */
const NUDGE_MM = 1;
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Runs the shortcut for a key press; returns false when the key isn't one. */
function handleShortcut(event: KeyboardEvent): boolean {
  const state = useJobStore.getState();
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  const key = event.key.toLowerCase();
  const hasSelection = state.selectedIds.length > 0;

  if (mod && key === 'z') {
    if (event.shiftKey) state.redo();
    else state.undo();
  } else if (mod && key === 'y') {
    state.redo();
  } else if (mod && key === 'a') {
    state.selectAll();
  } else if (mod && key === 'd') {
    arrange.duplicate();
  } else if (mod && key === 'g') {
    if (event.shiftKey) arrange.ungroup();
    else arrange.group();
  } else if ((key === 'delete' || key === 'backspace') && state.selectedToolpathId) {
    // A toolpath picked in the Pro list: delete the cut, not the shape.
    state.removeToolpaths([state.selectedToolpathId]);
  } else if ((key === 'delete' || key === 'backspace') && hasSelection) {
    arrange.remove();
  } else if (key === 'escape' && hasSelection) {
    state.select(null);
  } else if (ARROWS[event.key] && hasSelection && state.view === 'design') {
    const [dx, dy] = ARROWS[event.key]!;
    const step = event.shiftKey ? NUDGE_MM * 10 : NUDGE_MM;
    arrange.nudge({ x: dx * step, y: dy * step });
  } else {
    return false;
  }
  return true;
}

/**
 * Editing shortcuts (undo/redo, select all, duplicate, group, delete, nudge).
 * Ignored while typing in a field, so the field's own undo and arrows work.
 * Also warns before leaving the page with a design open, since nothing is saved.
 */
export function useAppShortcuts() {
  const hasObjects = useJobStore((s) => s.objects.length > 0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (handleShortcut(event)) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!hasObjects) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasObjects]);
}
