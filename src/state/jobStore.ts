import { create } from 'zustand';
import { withGroupMates } from '../core/job/arrange';
import type { DesignObject, Job, OriginAnchor, Stock } from '../core/job/job';
import type { ObjectTransform } from '../core/geometry/transform';
import { withBakedScale } from '../core/shapes/shapeObjects';
import { createBrowserStore } from '../persistence/keyValueStore';
import { createJobPrefsRepository, type JobPrefs } from '../persistence/jobPrefsRepository';
import type { Repository } from '../persistence/versionedRepository';
import { EMPTY_HISTORY, record, redo, undo, type History, type Snapshot } from './history';

export type View = 'design' | 'preview';

/**
 * How a click changes the selection:
 * - `replace`: select just this object (and its group).
 * - `toggle`: add it to, or take it out of, the selection (Shift-click).
 * - `keep`: leave a selection that already includes it alone, so pressing on
 *   one of several selected objects drags them all.
 */
export type SelectMode = 'replace' | 'toggle' | 'keep';

export interface JobState extends Job {
  /** Used for exported file names. */
  jobName: string;
  /**
   * The object the job is named after, until the user types a name. Renaming
   * that object (e.g. editing its text) renames the job too.
   */
  jobNameFrom: string | null;
  selectedIds: string[];
  view: View;
  history: History;

  setStock: (patch: Partial<Stock>) => void;
  setOrigin: (origin: OriginAnchor) => void;
  setMaterial: (materialId: string) => void;
  setJobName: (name: string) => void;
  addObject: (object: DesignObject) => void;
  /** Edits from the side panel; quick repeats on the same fields are one undo step. */
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  /** Moves/resizes from the canvas, possibly several objects at once. */
  setTransforms: (transforms: Record<string, ObjectTransform>) => void;
  /**
   * Replaces the design, e.g. after aligning or duplicating; optionally selects.
   * Changes with the same `key` in quick succession are one undo step.
   */
  setObjects: (objects: DesignObject[], selectedIds?: string[], key?: string) => void;
  removeObjects: (ids: string[]) => void;
  select: (id: string | null, mode?: SelectMode) => void;
  selectAll: () => void;
  undo: () => void;
  redo: () => void;
  setView: (view: View) => void;
}

/** Stretched rectangles and ellipses store their real size (see withBakedScale). */
const normalise = (objects: DesignObject[]) => objects.map(withBakedScale);

function nextSelection(state: JobState, id: string | null, mode: SelectMode): string[] {
  if (id === null) return [];
  const unit = withGroupMates(state.objects, [id]);
  const selected = state.selectedIds.includes(id);
  if (mode === 'keep' && selected) return state.selectedIds;
  if (mode !== 'toggle') return unit;
  return selected
    ? state.selectedIds.filter((s) => !unit.includes(s))
    : [...state.selectedIds, ...unit.filter((u) => !state.selectedIds.includes(u))];
}

/**
 * The design being worked on. Only stock, origin and material are remembered
 * between visits; the design itself is deliberately not saved (SPEC.md §2).
 * Changes to the design go through `change`, which records undo history.
 */
export function createJobStore(prefs: Repository<JobPrefs>, now: () => number = Date.now) {
  const store = create<JobState>()((set, get) => {
    const snapshot = (): Snapshot => ({
      objects: get().objects,
      selectedIds: get().selectedIds,
    });
    const change = (next: Partial<JobState>, key: string | null = null) =>
      set((s) => ({ ...next, history: record(s.history, snapshot(), key, now()) }));
    const restore = (step: { snapshot: Snapshot; history: History } | null) => {
      if (!step) return;
      const ids = new Set(step.snapshot.objects.map((o) => o.id));
      set({
        objects: step.snapshot.objects,
        selectedIds: step.snapshot.selectedIds.filter((id) => ids.has(id)),
        history: step.history,
        view: 'design',
      });
    };

    return {
      ...prefs.load(),
      objects: [],
      jobName: '',
      jobNameFrom: null,
      selectedIds: [],
      view: 'design',
      history: EMPTY_HISTORY,

      setStock: (patch) => set((s) => ({ stock: { ...s.stock, ...patch } })),
      setOrigin: (origin) => set({ origin }),
      setMaterial: (materialId) => set({ materialId }),
      setJobName: (jobName) => set({ jobName, jobNameFrom: null }),
      addObject: (object) =>
        change({
          objects: [...get().objects, object],
          selectedIds: [object.id],
          ...(!get().jobName && { jobName: object.name, jobNameFrom: object.id }),
          view: 'design',
        }),
      updateObject: (id, patch) =>
        change(
          {
            objects: get().objects.map((o) =>
              o.id === id ? withBakedScale({ ...o, ...patch }) : o,
            ),
            ...(patch.name && id === get().jobNameFrom && { jobName: patch.name }),
          },
          `${id}:${Object.keys(patch).sort().join(',')}`,
        ),
      setTransforms: (transforms) =>
        change({
          objects: normalise(
            get().objects.map((o) =>
              transforms[o.id] ? { ...o, transform: transforms[o.id]! } : o,
            ),
          ),
        }),
      setObjects: (objects, selectedIds, key) =>
        change({ objects: normalise(objects), ...(selectedIds && { selectedIds }) }, key),
      removeObjects: (ids) =>
        change({
          objects: get().objects.filter((o) => !ids.includes(o.id)),
          selectedIds: get().selectedIds.filter((s) => !ids.includes(s)),
        }),
      select: (id, mode = 'replace') => set((s) => ({ selectedIds: nextSelection(s, id, mode) })),
      selectAll: () => set((s) => ({ selectedIds: s.objects.map((o) => o.id) })),
      undo: () => restore(undo(get().history, snapshot())),
      redo: () => restore(redo(get().history, snapshot())),
      setView: (view) =>
        set((s) => ({ view, selectedIds: view === 'preview' ? [] : s.selectedIds })),
    };
  });

  store.subscribe((state, previous) => {
    if (
      state.stock !== previous.stock ||
      state.origin !== previous.origin ||
      state.materialId !== previous.materialId
    ) {
      prefs.save({ stock: state.stock, origin: state.origin, materialId: state.materialId });
    }
  });

  return store;
}

export const useJobStore = createJobStore(createJobPrefsRepository(createBrowserStore()));

/** The selected objects, in drawing order. */
export const selectedObjects = (s: Pick<JobState, 'objects' | 'selectedIds'>) =>
  s.objects.filter((o) => s.selectedIds.includes(o.id));
