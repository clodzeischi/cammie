import { create } from 'zustand';
import type { ObjectTransform } from '../core/geometry/transform';

interface DragPreviewState {
  /** Where shapes being dragged, resized or rotated on the canvas are right now. */
  transforms: Record<string, ObjectTransform> | null;
  set: (transforms: Record<string, ObjectTransform>) => void;
  clear: () => void;
}

/**
 * Positions of shapes mid-drag, for views that follow along live (the 3D
 * view). The design itself, and its undo history, only change on release.
 */
export const useDragPreviewStore = create<DragPreviewState>()((set) => ({
  transforms: null,
  set: (transforms) => set({ transforms }),
  clear: () => set({ transforms: null }),
}));
