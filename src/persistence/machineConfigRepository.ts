import {
  DEFAULT_MACHINE_CONFIG,
  type EndPosition,
  type MachineConfig,
} from '../core/machine/machineConfig';
import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

export const MACHINE_CONFIG_KEY = 'cammie.machine.v1';
const SCHEMA_VERSION = 1;

type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

function reviveEndPosition(value: unknown): EndPosition {
  if (!isObject(value)) return DEFAULT_MACHINE_CONFIG.endPosition;
  switch (value.mode) {
    case 'origin':
    case 'stay':
      return { mode: value.mode };
    case 'park':
      return { mode: 'park', x: num(value.x, 0), y: num(value.y, 0) };
    default:
      return DEFAULT_MACHINE_CONFIG.endPosition;
  }
}

/** Fills any missing or mistyped field from the defaults, field by field. */
export function reviveMachineConfig(stored: unknown): MachineConfig {
  const d = DEFAULT_MACHINE_CONFIG;
  if (!isObject(stored)) return structuredClone(d);
  const area = isObject(stored.workArea) ? stored.workArea : {};

  return {
    workArea: {
      x: num(area.x, d.workArea.x),
      y: num(area.y, d.workArea.y),
      z: num(area.z, d.workArea.z),
    },
    maxFeedXY: num(stored.maxFeedXY, d.maxFeedXY),
    maxFeedZ: num(stored.maxFeedZ, d.maxFeedZ),
    manualSpindle: stored.manualSpindle === true,
    maxSpindleRpm: num(stored.maxSpindleRpm, d.maxSpindleRpm),
    maxSValue: num(stored.maxSValue, d.maxSValue),
    safeZ: num(stored.safeZ, d.safeZ),
    spindleDwell: num(stored.spindleDwell, d.spindleDwell),
    customHeader: str(stored.customHeader, d.customHeader),
    customFooter: str(stored.customFooter, d.customFooter),
    endPosition: reviveEndPosition(stored.endPosition),
  };
}

export function createMachineConfigRepository(store: KeyValueStore): Repository<MachineConfig> {
  return createVersionedRepository(store, {
    key: MACHINE_CONFIG_KEY,
    version: SCHEMA_VERSION,
    defaults: () => structuredClone(DEFAULT_MACHINE_CONFIG),
    revive: (stored) => reviveMachineConfig(stored),
  });
}
