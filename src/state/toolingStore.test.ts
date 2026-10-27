import { createMemoryStore } from '../persistence/keyValueStore';
import {
  createCustomBitsRepository,
  createFeedOverridesRepository,
  CUSTOM_BITS_KEY,
  FEED_OVERRIDES_KEY,
} from '../persistence/toolingRepositories';
import { createToolingStore } from './toolingStore';

const storeOver = (kv = createMemoryStore()) => ({
  kv,
  store: createToolingStore(createCustomBitsRepository(kv), createFeedOverridesRepository(kv)),
});

describe('toolingStore', () => {
  it('remembers feeds per material + bit across reloads, and clears them', () => {
    const { kv, store } = storeOver();
    store.getState().setFeeds('plywood', 'flat-2', { feed: 400 });
    expect(storeOver(kv).store.getState().feedOverrides).toEqual({
      'plywood|flat-2': { feed: 400 },
    });
    store.getState().setFeeds('plywood', 'flat-2', {});
    expect(storeOver(kv).store.getState().feedOverrides).toEqual({});
  });

  it('adds, edits and removes custom bits after the built-in ones', () => {
    const { kv, store } = storeOver();
    const bit = { id: 'custom-1', name: 'My 6 mm', type: 'flat' as const, diameter: 6, flutes: 2 };
    store.getState().saveBit(bit);
    store.getState().saveBit({ ...bit, name: 'Renamed' });
    const reloaded = storeOver(kv).store.getState();
    expect(reloaded.customBits).toEqual([{ ...bit, name: 'Renamed' }]);
    expect(reloaded.bits.at(-1)!.name).toBe('Renamed');
    store.getState().removeBit('custom-1');
    expect(storeOver(kv).store.getState().customBits).toEqual([]);
  });

  it('drops malformed saved data', () => {
    const kv = createMemoryStore({
      [CUSTOM_BITS_KEY]: JSON.stringify({
        version: 1,
        data: [
          { id: 'x', name: 'bad', type: 'flat', diameter: -1, flutes: 2 },
          { id: 'v', name: 'V', type: 'vbit', diameter: 6, flutes: 1, angle: 90, tipDiameter: 0 },
          { id: 'r', name: 'Ball', type: 'round', diameter: 4, flutes: 2 },
          { id: 'u', name: 'Undercut', type: 'tslot', diameter: 4, flutes: 2 },
        ],
      }),
      [FEED_OVERRIDES_KEY]: JSON.stringify({
        version: 1,
        data: { nokey: { feed: 1 }, 'mdf|flat-2': { feed: 'fast', rpm: 9000 } },
      }),
    });
    const state = storeOver(kv).store.getState();
    expect(state.customBits.map((b) => b.id)).toEqual(['v', 'r']);
    expect(state.feedOverrides).toEqual({ 'mdf|flat-2': { rpm: 9000 } });
  });
});
