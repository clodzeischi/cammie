import { makeObject } from '../core/cam/testFixtures';
import { createMemoryStore } from '../persistence/keyValueStore';
import {
  createJobPrefsRepository,
  DEFAULT_JOB_PREFS,
  JOB_PREFS_KEY,
} from '../persistence/jobPrefsRepository';
import { createShapeObject, DEFAULT_RECT } from '../core/shapes/shapeObjects';
import { createJobStore } from './jobStore';

const newStore = (now = () => 0) =>
  createJobStore(createJobPrefsRepository(createMemoryStore()), now);

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
    expect(store.getState().selectedIds).toEqual(['b']);
    expect(store.getState().jobName).toBe('owl');
    // The name follows that object (text being typed) until the user names the job.
    store.getState().updateObject('a', { name: 'barn owl' });
    expect(store.getState().jobName).toBe('barn owl');
    store.getState().setJobName('Sign');
    store.getState().updateObject('a', { name: 'snowy owl' });
    expect(store.getState().jobName).toBe('Sign');
  });

  it('clears the selection when its object is removed or preview opens', () => {
    const store = createJobStore(createJobPrefsRepository(createMemoryStore()));
    store.getState().addObject(makeObject({ id: 'a' }));
    store.getState().setView('preview');
    expect(store.getState().selectedIds).toEqual([]);
    store.getState().select('a');
    store.getState().setView('design');
    expect(store.getState().selectedIds).toEqual(['a']);
    store.getState().removeObjects(['a']);
    expect(store.getState().selectedIds).toEqual([]);
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

  it('selects with Shift, keeps a selection when pressing on it, and selects whole groups', () => {
    const store = newStore();
    const { addObject, select, setObjects } = store.getState();
    addObject(makeObject({ id: 'a' }));
    addObject(makeObject({ id: 'b' }));
    addObject(makeObject({ id: 'c' }));
    select('a');
    select('b', 'toggle');
    expect(store.getState().selectedIds).toEqual(['a', 'b']);
    select('a', 'keep');
    expect(store.getState().selectedIds).toEqual(['a', 'b']);
    select('a', 'toggle');
    expect(store.getState().selectedIds).toEqual(['b']);

    const objects = store
      .getState()
      .objects.map((o) => (o.id === 'c' ? o : { ...o, groupId: 'g' }));
    setObjects(objects);
    select('a');
    expect(store.getState().selectedIds).toEqual(['a', 'b']);
    select('c', 'toggle');
    select('b', 'toggle');
    expect(store.getState().selectedIds).toEqual(['c']);
  });

  it('undoes and redoes design changes, restoring the selection', () => {
    const store = newStore();
    const s = () => store.getState();
    s().addObject(makeObject({ id: 'a' }));
    s().setTransforms({ a: { x: 50, y: 5, rotation: 0, scaleX: 1, scaleY: 1 } });
    s().removeObjects(['a']);
    expect(s().objects).toEqual([]);

    s().undo();
    expect(s().objects[0]!.transform.x).toBe(50);
    expect(s().selectedIds).toEqual(['a']);
    s().undo();
    expect(s().objects[0]!.transform.x).toBe(10);
    s().redo();
    expect(s().objects[0]!.transform.x).toBe(50);
    // A new change drops the redo steps.
    s().updateObject('a', { name: 'renamed' });
    s().redo();
    expect(s().objects[0]!.name).toBe('renamed');
    s().undo();
    s().undo();
    s().undo();
    expect(s().objects).toEqual([]);
    s().undo(); // nothing left: no-op
    expect(s().history.past).toEqual([]);
  });

  it('turns a burst of edits to the same field into one undo step', () => {
    let time = 0;
    const store = newStore(() => time);
    const s = () => store.getState();
    s().addObject(makeObject({ id: 'a' }));
    for (const name of ['1', '12', '120']) {
      time += 200;
      s().updateObject('a', { name });
    }
    time += 2000;
    s().updateObject('a', { name: 'later' });
    s().undo();
    expect(s().objects[0]!.name).toBe('120');
    s().undo();
    expect(s().objects[0]!.name).toBe('Logo');
  });

  it('stores the real size of stretched rectangles', () => {
    const store = newStore();
    const rect = createShapeObject('r', DEFAULT_RECT, store.getState().stock);
    store.getState().addObject(rect);
    store.getState().setTransforms({ r: { ...rect.transform, scaleX: 2 } });
    const [stretched] = store.getState().objects;
    expect(stretched!.shape).toMatchObject({ width: 120, height: 40 });
    expect(stretched!.transform.scaleX).toBe(1);
  });
});
