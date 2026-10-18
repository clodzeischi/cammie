import type { MachineConfig } from '../machine/machineConfig';
import { presetFeeds, type Feeds, type Material } from '../materials/materials';
import type { Bit } from '../tools/bits';

export interface ResolvedFeeds {
  feeds: Feeds;
  /** Human-readable notes about values that were clamped to machine limits. */
  clamped: string[];
  /** Fields that aren't usable numbers (≤ 0 or empty). */
  invalid: Array<keyof Feeds>;
}

const LABELS: Record<keyof Feeds, string> = {
  feed: 'Feed',
  plunge: 'Plunge',
  depthPerPass: 'Depth per pass',
  rpm: 'Spindle speed',
  stepover: 'Stepover',
};

/** Material preset → remembered overrides for this material + bit → machine limits. */
export function resolveFeeds(
  material: Material,
  bit: Bit,
  overrides: Partial<Feeds>,
  machine: MachineConfig,
): ResolvedFeeds {
  const wanted: Feeds = { ...presetFeeds(material, bit), ...overrides };
  const invalid = (Object.keys(wanted) as Array<keyof Feeds>).filter(
    (key) => !Number.isFinite(wanted[key]) || wanted[key] <= 0,
  );

  const clamped: string[] = [];
  const limit = (key: keyof Feeds, max: number, unit: string) => {
    if (wanted[key] > max) {
      clamped.push(
        key === 'stepover'
          ? `Stepover lowered from ${wanted[key]}% to 100% of the bit.`
          : `${LABELS[key]} lowered from ${wanted[key]} to the machine max of ${max} ${unit}.`,
      );
      return max;
    }
    return wanted[key];
  };

  return {
    feeds: {
      feed: limit('feed', machine.maxFeedXY, 'mm/min'),
      plunge: limit('plunge', machine.maxFeedZ, 'mm/min'),
      depthPerPass: wanted.depthPerPass,
      rpm: limit('rpm', machine.maxSpindleRpm, 'RPM'),
      stepover: limit('stepover', 100, '%'),
    },
    clamped,
    invalid,
  };
}

export const feedLabel = (key: keyof Feeds) => LABELS[key];
