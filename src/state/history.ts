import type { DesignObject, Toolpath } from '../core/job/job';

/** What undo restores: the design, its cuts and what was selected at the time. */
export interface Snapshot {
  objects: DesignObject[];
  toolpaths: Toolpath[];
  selectedIds: string[];
}

export interface History {
  past: Snapshot[];
  future: Snapshot[];
  /** Identifies the last change, so a burst of the same edit is one undo step. */
  lastKey: string | null;
  lastAt: number;
}

/** Undo steps kept (SPEC.md §5.1 asks for at least 50). */
export const HISTORY_LIMIT = 100;
/** Repeats of the same edit within this long (ms) merge, e.g. typing "120" into Width. */
export const COALESCE_MS = 1000;

export const EMPTY_HISTORY: History = { past: [], future: [], lastKey: null, lastAt: 0 };

/**
 * Records the state from before a change. Pass a `key` for edits that arrive
 * in bursts (keystrokes); a change with the same key soon after the last one
 * joins its undo step instead of adding another.
 */
export function record(history: History, before: Snapshot, key: string | null, now: number) {
  const merge = key !== null && key === history.lastKey && now - history.lastAt < COALESCE_MS;
  return {
    past: merge ? history.past : [...history.past, before].slice(-HISTORY_LIMIT),
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

/** Steps back: returns the snapshot to restore, or null when there's nothing to undo. */
export function undo(history: History, current: Snapshot) {
  const previous = history.past[history.past.length - 1];
  if (!previous) return null;
  return {
    snapshot: previous,
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
      lastKey: null,
      lastAt: 0,
    },
  };
}

export function redo(history: History, current: Snapshot) {
  const [next, ...future] = history.future;
  if (!next) return null;
  return {
    snapshot: next,
    history: { past: [...history.past, current], future, lastKey: null, lastAt: 0 },
  };
}
