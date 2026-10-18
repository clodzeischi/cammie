import type { Feeds } from './materials';

/**
 * Feeds the user changed, remembered per material + bit pair (SPEC.md §8),
 * so every cut with that bit in that material uses the same tuned values.
 */
export type FeedOverrides = Record<string, Partial<Feeds>>;

export const overrideKey = (materialId: string, bitId: string) => `${materialId}|${bitId}`;

export const overridesFor = (
  all: FeedOverrides,
  materialId: string,
  bitId: string,
): Partial<Feeds> => all[overrideKey(materialId, bitId)] ?? {};
