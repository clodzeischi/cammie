import { create } from 'zustand';
import { overrideKey, type FeedOverrides } from '../core/materials/feedOverrides';
import type { Feeds } from '../core/materials/materials';
import { BUILT_IN_BITS, type Bit } from '../core/tools/bits';
import { createBrowserStore } from '../persistence/keyValueStore';
import {
  createCustomBitsRepository,
  createFeedOverridesRepository,
} from '../persistence/toolingRepositories';
import type { Repository } from '../persistence/versionedRepository';

export interface ToolingState {
  customBits: Bit[];
  /** Built-in bits followed by the user's own. */
  bits: Bit[];
  feedOverrides: FeedOverrides;

  saveBit: (bit: Bit) => void;
  removeBit: (id: string) => void;
  /** Replaces the remembered feeds for a material + bit; an empty object clears them. */
  setFeeds: (materialId: string, bitId: string, feeds: Partial<Feeds>) => void;
}

/** Custom bits and remembered feeds: both survive reloads (SPEC.md §7.1, §8). */
export function createToolingStore(
  bitsRepo: Repository<Bit[]>,
  feedsRepo: Repository<FeedOverrides>,
) {
  const customBits = bitsRepo.load();
  return create<ToolingState>()((set) => ({
    customBits,
    bits: [...BUILT_IN_BITS, ...customBits],
    feedOverrides: feedsRepo.load(),

    saveBit: (bit) =>
      set((s) => {
        const exists = s.customBits.some((b) => b.id === bit.id);
        const next = exists
          ? s.customBits.map((b) => (b.id === bit.id ? bit : b))
          : [...s.customBits, bit];
        bitsRepo.save(next);
        return { customBits: next, bits: [...BUILT_IN_BITS, ...next] };
      }),
    removeBit: (id) =>
      set((s) => {
        const next = s.customBits.filter((b) => b.id !== id);
        bitsRepo.save(next);
        return { customBits: next, bits: [...BUILT_IN_BITS, ...next] };
      }),
    setFeeds: (materialId, bitId, feeds) =>
      set((s) => {
        const next = { ...s.feedOverrides };
        const key = overrideKey(materialId, bitId);
        if (Object.keys(feeds).length > 0) next[key] = feeds;
        else delete next[key];
        feedsRepo.save(next);
        return { feedOverrides: next };
      }),
  }));
}

const browser = createBrowserStore();
export const useToolingStore = createToolingStore(
  createCustomBitsRepository(browser),
  createFeedOverridesRepository(browser),
);
