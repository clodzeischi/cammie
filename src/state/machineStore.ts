import { create } from 'zustand';
import type { MachineConfig } from '../core/machine/machineConfig';
import { createBrowserStore } from '../persistence/keyValueStore';
import { createMachineConfigRepository } from '../persistence/machineConfigRepository';
import type { Repository } from '../persistence/versionedRepository';

export interface MachineState {
  config: MachineConfig;
  /** Replace the machine config and persist it. */
  save: (config: MachineConfig) => void;
}

export function createMachineStore(repository: Repository<MachineConfig>) {
  return create<MachineState>()((set) => ({
    config: repository.load(),
    save: (config) => {
      repository.save(config);
      set({ config });
    },
  }));
}

export const useMachineStore = createMachineStore(
  createMachineConfigRepository(createBrowserStore()),
);
