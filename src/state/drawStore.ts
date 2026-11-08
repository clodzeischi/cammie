import { create } from 'zustand';
import type { Vec2 } from '../core/geometry/path';

/** Tools that place points on the canvas one click at a time. */
export type DrawTool = 'line' | 'curve';

/** Smoothing a new curve starts with: a smooth curve through every point. */
export const CURVE_SMOOTHING = 1;

export interface DrawState {
  /** The tool being drawn with, or null when the canvas selects and moves shapes. */
  tool: DrawTool | null;
  /** Points placed so far, in canvas mm. */
  points: Vec2[];
  /** The line or curve whose points are being moved, if any. */
  editingId: string | null;

  start: (tool: DrawTool) => void;
  addPoint: (p: Vec2) => void;
  /** Takes back the last point (Backspace while drawing). */
  removeLastPoint: () => void;
  /** Stops drawing and forgets the points. */
  cancel: () => void;
  setEditing: (id: string | null) => void;
}

/**
 * Drawing in progress isn't part of the design, so it's kept out of the job
 * store and its undo history: only the finished line becomes an object.
 */
export const useDrawStore = create<DrawState>()((set) => ({
  tool: null,
  points: [],
  editingId: null,
  start: (tool) => set({ tool, points: [], editingId: null }),
  addPoint: (p) => set((s) => ({ points: [...s.points, p] })),
  removeLastPoint: () => set((s) => ({ points: s.points.slice(0, -1) })),
  cancel: () => set({ tool: null, points: [] }),
  setEditing: (editingId) => set({ editingId }),
}));
