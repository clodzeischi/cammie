import { useEffect } from 'react';
import { arrange } from '../state/arrangeActions';
import { copySelection, cutSelection, paste } from '../state/clipboard';
import { finishDrawing } from '../state/drawActions';
import { useDrawStore } from '../state/drawStore';
import { useJobStore } from '../state/jobStore';
import { IS_MAC } from '../ui/common/platform';
import { toolForKey } from '../ui/toolbar/tools';

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

/** Keys while drawing a line or editing its points; returns false when the key isn't one. */
function handleDrawingKey(key: string): boolean {
  const draw = useDrawStore.getState();
  if (draw.tool) {
    if (key === 'enter') finishDrawing(false);
    else if (key === 'escape') draw.cancel();
    else if (key === 'backspace' || key === 'delete') draw.removeLastPoint();
    else return false;
    return true;
  }
  if (draw.editingId && (key === 'escape' || key === 'enter')) {
    draw.setEditing(null);
    return true;
  }
  return false;
}

/** Runs the shortcut for a key press; returns false when the key isn't one. */
function handleShortcut(event: KeyboardEvent): boolean {
  const state = useJobStore.getState();
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  const key = event.key.toLowerCase();
  const hasSelection = state.selectedIds.length > 0;

  if (!mod && handleDrawingKey(key)) return true;
  // Tools on the left rail have single-key shortcuts (V, L, C, T, R, E, P, S, G, H, I).
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  const tool = plain ? toolForKey(key) : undefined;
  if (tool) {
    tool.run();
    return true;
  }
  if (mod && key === 'c') return copySelection();
  if (mod && key === 'x') return cutSelection();
  if (mod && key === 'v') return paste();

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
 * Editing shortcuts (undo/redo, select all, cut/copy/paste, duplicate, group,
 * delete, nudge, finishing or cancelling a line being drawn) and the tool
 * rail's single keys.
 * Ignored while typing in a field, so the field's own undo and arrows work.
 * Save and Open (⌘S, ⌘O) live with their buttons in ProjectButtons.
 */
export function useAppShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (handleShortcut(event)) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
