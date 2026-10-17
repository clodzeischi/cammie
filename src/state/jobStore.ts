import { create } from 'zustand';
import type { DesignObject, Job, OriginAnchor, Stock } from '../core/job/job';
import { createBrowserStore } from '../persistence/keyValueStore';
import { createJobPrefsRepository, type JobPrefs } from '../persistence/jobPrefsRepository';
import type { Repository } from '../persistence/versionedRepository';

export type View = 'design' | 'preview';

export interface JobState extends Job {
  /** Used for exported file names. */
  jobName: string;
  selectedId: string | null;
  view: View;

  setStock: (patch: Partial<Stock>) => void;
  setOrigin: (origin: OriginAnchor) => void;
  setMaterial: (materialId: string) => void;
  setJobName: (name: string) => void;
  addObject: (object: DesignObject) => void;
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  removeObject: (id: string) => void;
  select: (id: string | null) => void;
  setView: (view: View) => void;
}

/**
 * The design being worked on. Only stock, origin and material are remembered
 * between visits; the design itself is deliberately not saved (SPEC.md §2).
 */
export function createJobStore(prefs: Repository<JobPrefs>) {
  const store = create<JobState>()((set) => ({
    ...prefs.load(),
    objects: [],
    jobName: '',
    selectedId: null,
    view: 'design',

    setStock: (patch) => set((s) => ({ stock: { ...s.stock, ...patch } })),
    setOrigin: (origin) => set({ origin }),
    setMaterial: (materialId) => set({ materialId }),
    setJobName: (jobName) => set({ jobName }),
    addObject: (object) =>
      set((s) => ({
        objects: [...s.objects, object],
        selectedId: object.id,
        jobName: s.jobName || object.name,
        view: 'design',
      })),
    updateObject: (id, patch) =>
      set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
    removeObject: (id) =>
      set((s) => ({
        objects: s.objects.filter((o) => o.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),
    select: (selectedId) => set({ selectedId }),
    setView: (view) => set((s) => ({ view, selectedId: view === 'preview' ? null : s.selectedId })),
  }));

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
