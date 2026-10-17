import { makeObject } from '../core/cam/testFixtures';
import { createMemoryStore } from '../persistence/keyValueStore';
import {
  createJobPrefsRepository,
  DEFAULT_JOB_PREFS,
  JOB_PREFS_KEY,
} from '../persistence/jobPrefsRepository';
import { createJobStore } from './jobStore';

describe('jobStore', () => {
  it('remembers stock, origin and material, but not the design', () => {
    const kv = createMemoryStore();
    const store = createJobStore(createJobPrefsRepository(kv));
    store.getState().setStock({ width: 120 });
    store.getState().setOrigin('center');
    store.getState().addObject(makeObject());

    const reloaded = createJobStore(createJobPrefsRepository(kv)).getState();
    expect(reloaded.stock).toEqual({ ...DEFAULT_JOB_PREFS.stock, width: 120 });
    expect(reloaded.origin).toBe('center');
    expect(reloaded.objects).toEqual([]);
  });

  it('selects new objects and names the job after the first one', () => {
    const store = createJobStore(createJobPrefsRepository(createMemoryStore()));
    store.getState().addObject(makeObject({ id: 'a', name: 'owl' }));
    store.getState().addObject(makeObject({ id: 'b', name: 'fox' }));
    expect(store.getState().selectedId).toBe('b');
    expect(store.getState().jobName).toBe('owl');
  });

  it('clears the selection when its object is removed or preview opens', () => {
    const store = createJobStore(createJobPrefsRepository(createMemoryStore()));
    store.getState().addObject(makeObject({ id: 'a' }));
    store.getState().setView('preview');
    expect(store.getState().selectedId).toBeNull();
    store.getState().select('a');
    store.getState().setView('design');
    expect(store.getState().selectedId).toBe('a');
    store.getState().removeObject('a');
    expect(store.getState().selectedId).toBeNull();
  });

  it('ignores invalid saved prefs', () => {
    const raw = JSON.stringify({
      version: 1,
      data: { origin: 'moon', materialId: 'cheese', stock: { width: -4 } },
    });
    const state = createJobStore(
      createJobPrefsRepository(createMemoryStore({ [JOB_PREFS_KEY]: raw })),
    ).getState();
    expect(state.origin).toBe(DEFAULT_JOB_PREFS.origin);
    expect(state.materialId).toBe(DEFAULT_JOB_PREFS.materialId);
    expect(state.stock.width).toBe(DEFAULT_JOB_PREFS.stock.width);
  });
});
