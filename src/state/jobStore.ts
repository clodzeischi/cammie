import { create } from 'zustand';
import { withGroupMates } from '../core/job/arrange';
import type {
  DesignObject,
  Face,
  FlipAxis,
  Job,
  Operation,
  OriginAnchor,
  Stock,
  Toolpath,
} from '../core/job/job';
import { cutKindOf, defaultOperation } from '../core/job/objectFactory';
import { insertToolpath, repositionToolpath, toolpathsOf } from '../core/job/toolpaths';
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
  /** The toolpath shown in the side panel (Pro mode); its object is selected too. */
  selectedToolpathId: string | null;
  view: View;
  history: History;

  setStock: (patch: Partial<Stock>) => void;
  setOrigin: (origin: OriginAnchor) => void;
  setMaterial: (materialId: string) => void;
  /** How the stock is turned over for bottom cuts. */
  setFlip: (flip: FlipAxis) => void;
  setJobName: (name: string) => void;
  /** Adds an object with its first cut; pass null to add it uncut. */
  addObject: (object: DesignObject, operation?: Operation | null) => void;
  /** Edits from the side panel; quick repeats on the same fields are one undo step. */
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  /** Moves/resizes from the canvas, possibly several objects at once. */
  setTransforms: (transforms: Record<string, ObjectTransform>) => void;
  /**
   * Replaces the design, e.g. after aligning or duplicating; optionally selects.
   * Changes with the same `key` in quick succession are one undo step.
   */
  setObjects: (
    objects: DesignObject[],
    selectedIds?: string[],
    key?: string,
    toolpaths?: Toolpath[],
  ) => void;
  removeObjects: (ids: string[]) => void;
  /** Gives each object a new toolpath where it naturally runs, and selects the first. */
  addToolpaths: (objectIds: string[], operation: (objectId: string) => Operation) => void;
  /** Settings edits; `reposition` moves it to its natural place (its cut type changed). */
  updateToolpath: (id: string, operation: Operation, reposition?: boolean) => void;
  /** Moves a toolpath to the top or bottom of the stock (and to its natural place there). */
  setToolpathFace: (id: string, face: Face) => void;
  /** Reorders or rewrites the whole list (moving files, changing every bit). */
  setToolpaths: (toolpaths: Toolpath[]) => void;
  removeToolpaths: (ids: string[]) => void;
  /** Easy mode: each object's one cut (null = none), as one undo step. */
  setObjectCuts: (cuts: Record<string, Operation | null>) => void;
  selectToolpath: (id: string | null) => void;
  select: (id: string | null, mode?: SelectMode) => void;
  selectAll: () => void;
  undo: () => void;
  redo: () => void;
  setView: (view: View) => void;
  /** Replaces everything with an opened project; it starts with no undo history. */
  loadProject: (project: { jobName: string; job: Job }) => void;
  /** Starts an empty design, keeping the stock, origin and material. */
  clearDesign: () => void;
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
 * The design being worked on. Stock, origin and material are remembered as
 * preferences between visits; the design itself is saved as a project file.
 * Changes to the design or its toolpaths go through `change`, which records undo history.
 */
export function createJobStore(prefs: Repository<JobPrefs>, now: () => number = Date.now) {
  const store = create<JobState>()((set, get) => {
    const snapshot = (): Snapshot => ({
      objects: get().objects,
      toolpaths: get().toolpaths,
      selectedIds: get().selectedIds,
    });
    const newToolpath = (objectId: string, operation: Operation): Toolpath => ({
      id: crypto.randomUUID(),
      objectId,
      operation,
    });
    const change = (next: Partial<JobState>, key: string | null = null) =>
      set((s) => ({ ...next, history: record(s.history, snapshot(), key, now()) }));
    const restore = (step: { snapshot: Snapshot; history: History } | null) => {
      if (!step) return;
      const ids = new Set(step.snapshot.objects.map((o) => o.id));
      const selectedToolpathId = get().selectedToolpathId;
      set({
        objects: step.snapshot.objects,
        toolpaths: step.snapshot.toolpaths,
        selectedIds: step.snapshot.selectedIds.filter((id) => ids.has(id)),
        selectedToolpathId: step.snapshot.toolpaths.some((t) => t.id === selectedToolpathId)
          ? selectedToolpathId
          : null,
        history: step.history,
        view: 'design',
      });
    };

    return {
      ...prefs.load(),
      objects: [],
      toolpaths: [],
      flip: 'left-right',
      jobName: '',
      jobNameFrom: null,
      selectedIds: [],
      selectedToolpathId: null,
      view: 'design',
      history: EMPTY_HISTORY,

      setStock: (patch) => set((s) => ({ stock: { ...s.stock, ...patch } })),
      setOrigin: (origin) => set({ origin }),
      setMaterial: (materialId) => set({ materialId }),
      setFlip: (flip) => set({ flip }),
      setJobName: (jobName) => set({ jobName, jobNameFrom: null }),
      addObject: (object, operation = defaultOperation()) =>
        change({
          objects: [...get().objects, object],
          toolpaths: operation
            ? insertToolpath(get().toolpaths, newToolpath(object.id, operation))
            : get().toolpaths,
          selectedIds: [object.id],
          selectedToolpathId: null,
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
      setObjects: (objects, selectedIds, key, toolpaths) =>
        change(
          {
            objects: normalise(objects),
            ...(selectedIds && { selectedIds, selectedToolpathId: null }),
            ...(toolpaths && { toolpaths }),
          },
          key,
        ),
      removeObjects: (ids) => {
        const toolpaths = get().toolpaths.filter((t) => !ids.includes(t.objectId));
        change({
          objects: get().objects.filter((o) => !ids.includes(o.id)),
          toolpaths,
          selectedIds: get().selectedIds.filter((s) => !ids.includes(s)),
          selectedToolpathId: toolpaths.some((t) => t.id === get().selectedToolpathId)
            ? get().selectedToolpathId
            : null,
        });
      },
      addToolpaths: (objectIds, operation) => {
        const added = objectIds.map((id) => newToolpath(id, operation(id)));
        if (added.length === 0) return;
        change({
          toolpaths: added.reduce(insertToolpath, get().toolpaths),
          selectedToolpathId: added[0]!.id,
          selectedIds: [added[0]!.objectId],
        });
      },
      updateToolpath: (id, operation, reposition = false) => {
        const updated = get().toolpaths.map((t) => (t.id === id ? { ...t, operation } : t));
        change(
          { toolpaths: reposition ? repositionToolpath(updated, id) : updated },
          reposition ? null : `toolpath:${id}`,
        );
      },
      setToolpathFace: (id, face) => {
        const updated = get().toolpaths.map((t) => {
          if (t.id !== id) return t;
          // The top is the default, so it's stored as no face at all.
          const moved: Toolpath = { ...t, face };
          if (face === 'top') delete moved.face;
          return moved;
        });
        change({ toolpaths: repositionToolpath(updated, id) });
      },
      setToolpaths: (toolpaths) => change({ toolpaths }),
      removeToolpaths: (ids) =>
        change({
          toolpaths: get().toolpaths.filter((t) => !ids.includes(t.id)),
          selectedToolpathId: ids.includes(get().selectedToolpathId ?? '')
            ? null
            : get().selectedToolpathId,
        }),
      setObjectCuts: (cuts) => {
        let toolpaths = get().toolpaths;
        let kindChanged = false;
        for (const [objectId, operation] of Object.entries(cuts)) {
          const [current] = toolpathsOf(toolpaths, objectId);
          const others = toolpaths.filter((t) => t.objectId !== objectId);
          if (!operation) {
            kindChanged ||= Boolean(current);
            toolpaths = others;
          } else if (current && cutKindOf(current.operation) === cutKindOf(operation)) {
            toolpaths = toolpaths.map((t) => (t.id === current.id ? { ...t, operation } : t));
          } else {
            kindChanged = true;
            const toolpath = current ? { ...current, operation } : newToolpath(objectId, operation);
            toolpaths = insertToolpath(others, toolpath);
          }
        }
        change({ toolpaths }, kindChanged ? null : `cuts:${Object.keys(cuts).join(',')}`);
      },
      selectToolpath: (id) => {
        const toolpath = get().toolpaths.find((t) => t.id === id);
        set({
          selectedToolpathId: toolpath ? toolpath.id : null,
          selectedIds: toolpath ? [toolpath.objectId] : get().selectedIds,
        });
      },
      select: (id, mode = 'replace') =>
        set((s) => ({ selectedIds: nextSelection(s, id, mode), selectedToolpathId: null })),
      selectAll: () =>
        set((s) => ({ selectedIds: s.objects.map((o) => o.id), selectedToolpathId: null })),
      undo: () => restore(undo(get().history, snapshot())),
      redo: () => restore(redo(get().history, snapshot())),
      loadProject: ({ jobName, job }) =>
        set({
          ...job,
          jobName,
          jobNameFrom: null,
          selectedIds: [],
          selectedToolpathId: null,
          view: 'design',
          history: EMPTY_HISTORY,
        }),
      clearDesign: () =>
        set({
          objects: [],
          toolpaths: [],
          jobName: '',
          jobNameFrom: null,
          selectedIds: [],
          selectedToolpathId: null,
          view: 'design',
          history: EMPTY_HISTORY,
        }),
      setView: (view) =>
        set((s) => ({
          view,
          selectedIds: view === 'preview' ? [] : s.selectedIds,
          selectedToolpathId: view === 'preview' ? null : s.selectedToolpathId,
        })),
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
