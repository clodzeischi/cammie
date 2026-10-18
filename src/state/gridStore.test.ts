import { createMemoryStore } from '../persistence/keyValueStore';
import {
  createGridPrefsRepository,
  DEFAULT_GRID_PREFS,
  GRID_PREFS_KEY,
} from '../persistence/gridPrefsRepository';
import { createGridStore } from './gridStore';

describe('gridStore', () => {
  it('remembers spacing and snapping', () => {
    const kv = createMemoryStore();
    const store = createGridStore(createGridPrefsRepository(kv));
    store.getState().setSpacing(5);
    store.getState().setSnap(false);
    const reloaded = createGridStore(createGridPrefsRepository(kv)).getState();
    expect([reloaded.spacing, reloaded.snap]).toEqual([5, false]);
  });

  it('ignores spacings that are not offered (a 0.001 mm grid would be millions of lines)', () => {
    const raw = JSON.stringify({ version: 1, data: { spacing: 0.001, snap: 'yes' } });
    const state = createGridStore(
      createGridPrefsRepository(createMemoryStore({ [GRID_PREFS_KEY]: raw })),
    ).getState();
    expect([state.spacing, state.snap]).toEqual([
      DEFAULT_GRID_PREFS.spacing,
      DEFAULT_GRID_PREFS.snap,
    ]);
  });
});
