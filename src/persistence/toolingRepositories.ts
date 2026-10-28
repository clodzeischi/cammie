import type { FeedOverrides } from '../core/materials/feedOverrides';
import type { Feeds } from '../core/materials/materials';
import type { Bit } from '../core/tools/bits';
import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

export const FEED_OVERRIDES_KEY = 'cammie.feedOverrides.v1';
export const CUSTOM_BITS_KEY = 'cammie.bits.v1';

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

const FEED_KEYS: Array<keyof Feeds> = ['feed', 'plunge', 'depthPerPass', 'rpm', 'stepover'];

/** Keeps only well-formed `material|bit → { field: number }` entries. */
export function reviveFeedOverrides(stored: unknown): FeedOverrides {
  if (!isObject(stored)) return {};
  const result: FeedOverrides = {};
  for (const [key, value] of Object.entries(stored)) {
    if (!isObject(value) || !key.includes('|')) continue;
    const feeds: Partial<Feeds> = {};
    for (const field of FEED_KEYS) if (positive(value[field])) feeds[field] = value[field];
    if (Object.keys(feeds).length > 0) result[key] = feeds;
  }
  return result;
}

/** Keeps only complete, sensible custom bits. */
export function reviveCustomBits(stored: unknown): Bit[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((b): Bit[] => {
    if (!isObject(b) || typeof b.id !== 'string' || typeof b.name !== 'string') return [];
    if (!positive(b.diameter) || !positive(b.flutes)) return [];
    const base = { id: b.id, name: b.name, diameter: b.diameter, flutes: Math.round(b.flutes) };
    if (b.type === 'flat' || b.type === 'round') return [{ ...base, type: b.type }];
    if (
      b.type === 'vbit' &&
      positive(b.angle) &&
      b.angle < 180 &&
      typeof b.tipDiameter === 'number' &&
      b.tipDiameter >= 0
    ) {
      return [{ ...base, type: 'vbit', angle: b.angle, tipDiameter: b.tipDiameter }];
    }
    return [];
  });
}

export const createFeedOverridesRepository = (store: KeyValueStore): Repository<FeedOverrides> =>
  createVersionedRepository(store, {
    key: FEED_OVERRIDES_KEY,
    version: 1,
    defaults: () => ({}),
    revive: reviveFeedOverrides,
  });

export const createCustomBitsRepository = (store: KeyValueStore): Repository<Bit[]> =>
  createVersionedRepository(store, {
    key: CUSTOM_BITS_KEY,
    version: 1,
    defaults: () => [],
    revive: reviveCustomBits,
  });
