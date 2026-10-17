import { DEFAULT_MACHINE_CONFIG } from '../core/machine/machineConfig';
import { createMemoryStore } from './keyValueStore';
import { createMachineConfigRepository, MACHINE_CONFIG_KEY } from './machineConfigRepository';

const storeWith = (raw: string) => createMemoryStore({ [MACHINE_CONFIG_KEY]: raw });

describe('machineConfigRepository', () => {
  it('returns defaults when nothing is stored', () => {
    const repo = createMachineConfigRepository(createMemoryStore());
    expect(repo.load()).toEqual(DEFAULT_MACHINE_CONFIG);
  });

  it('round-trips a saved config', () => {
    const repo = createMachineConfigRepository(createMemoryStore());
    const custom = {
      ...DEFAULT_MACHINE_CONFIG,
      safeZ: 8,
      endPosition: { mode: 'park' as const, x: 10, y: 170 },
    };
    repo.save(custom);
    expect(repo.load()).toEqual(custom);
  });

  it('does not hand out the shared defaults object', () => {
    const repo = createMachineConfigRepository(createMemoryStore());
    repo.load().workArea.x = 1;
    expect(DEFAULT_MACHINE_CONFIG.workArea.x).toBe(300);
  });

  it('fills missing and mistyped fields from defaults', () => {
    const raw = JSON.stringify({ version: 1, data: { safeZ: 'tall', workArea: { x: 400 } } });
    const config = createMachineConfigRepository(storeWith(raw)).load();
    expect(config.workArea).toEqual({ x: 400, y: 180, z: 45 });
    expect(config.safeZ).toBe(DEFAULT_MACHINE_CONFIG.safeZ);
  });

  it('falls back to defaults for corrupt JSON', () => {
    const repo = createMachineConfigRepository(storeWith('{not json'));
    expect(repo.load()).toEqual(DEFAULT_MACHINE_CONFIG);
  });

  it('falls back to defaults for a newer schema version', () => {
    const raw = JSON.stringify({ version: 99, data: { safeZ: 20 } });
    expect(createMachineConfigRepository(storeWith(raw)).load()).toEqual(DEFAULT_MACHINE_CONFIG);
  });
});
