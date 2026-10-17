import { DEFAULT_MACHINE_CONFIG } from '../core/machine/machineConfig';
import { createMemoryStore } from '../persistence/keyValueStore';
import { createMachineConfigRepository } from '../persistence/machineConfigRepository';
import { createMachineStore } from './machineStore';

describe('machineStore', () => {
  it('loads from and saves to its repository', () => {
    const kv = createMemoryStore();
    const store = createMachineStore(createMachineConfigRepository(kv));
    expect(store.getState().config).toEqual(DEFAULT_MACHINE_CONFIG);

    const updated = { ...DEFAULT_MACHINE_CONFIG, maxFeedXY: 1500 };
    store.getState().save(updated);
    expect(store.getState().config.maxFeedXY).toBe(1500);

    // A fresh store over the same storage sees the saved value, like after a reload.
    const reloaded = createMachineStore(createMachineConfigRepository(kv));
    expect(reloaded.getState().config.maxFeedXY).toBe(1500);
  });
});
