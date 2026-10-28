import { profileOp } from '../core/cam/testFixtures';
import { createMemoryStore } from '../persistence/keyValueStore';
import {
  createModePrefsRepository,
  DEFAULT_MODE_PREFS,
  MODE_PREFS_KEY,
} from '../persistence/modePrefsRepository';
import { createModeStore, newObjectOperation } from './modeStore';

describe('modeStore', () => {
  it('starts new visitors in Easy and remembers the last mode', () => {
    const kv = createMemoryStore();
    const store = createModeStore(createModePrefsRepository(kv));
    expect(store.getState().mode).toBe('easy');
    store.getState().setMode('pro');
    store.getState().setEasyBit('flat-2');
    const reloaded = createModeStore(createModePrefsRepository(kv)).getState();
    expect([reloaded.mode, reloaded.easyBitId]).toEqual(['pro', 'flat-2']);
  });

  it('falls back to Easy for unreadable prefs', () => {
    const raw = JSON.stringify({ version: 1, data: { mode: 'expert', easyBitId: 7 } });
    const state = createModeStore(
      createModePrefsRepository(createMemoryStore({ [MODE_PREFS_KEY]: raw })),
    ).getState();
    expect(state.mode).toBe('easy');
    expect(state.easyBitId).toBe(DEFAULT_MODE_PREFS.easyBitId);
  });
});

describe('newObjectOperation', () => {
  it('engraves new shapes with the Easy bit, and leaves them uncut in Pro', () => {
    expect(newObjectOperation([], { mode: 'easy', easyBitId: 'vbit-90' })).toMatchObject({
      type: 'profile',
      side: 'on',
      bitId: 'vbit-90',
    });
    expect(newObjectOperation([], { mode: 'pro', easyBitId: 'vbit-90' })).toBeNull();
  });

  it("uses the design's bit in Easy, so a new shape never adds a bit change", () => {
    const existing = [{ id: 't', objectId: 'o', operation: profileOp({ bitId: 'flat-2' }) }];
    expect(newObjectOperation(existing, { mode: 'easy', easyBitId: 'vbit-90' })?.bitId).toBe(
      'flat-2',
    );
  });
});
