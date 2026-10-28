import { createMemoryStore } from '../persistence/keyValueStore';
import {
  createView3DPrefsRepository,
  DEFAULT_VIEW3D_PREFS,
  VIEW3D_PREFS_KEY,
} from '../persistence/view3dPrefsRepository';
import { createView3DStore } from './view3dStore';

describe('view3dStore', () => {
  it('starts open, remembers the pane, and keeps its width within limits', () => {
    const kv = createMemoryStore();
    const store = createView3DStore(createView3DPrefsRepository(kv));
    expect(store.getState()).toMatchObject(DEFAULT_VIEW3D_PREFS);
    store.getState().toggle();
    store.getState().setShare(0.95);
    const reloaded = createView3DStore(createView3DPrefsRepository(kv)).getState();
    expect(reloaded).toMatchObject({ open: false, share: 0.75 });
  });

  it('falls back to the defaults for unreadable prefs', () => {
    const kv = createMemoryStore({
      [VIEW3D_PREFS_KEY]: JSON.stringify({ version: 1, data: { open: 'yes', share: 'wide' } }),
    });
    expect(createView3DStore(createView3DPrefsRepository(kv)).getState()).toMatchObject(
      DEFAULT_VIEW3D_PREFS,
    );
  });
});
