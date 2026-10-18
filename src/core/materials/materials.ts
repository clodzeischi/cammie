import type { Bit } from '../tools/bits';

/**
 * Feeds and speeds used for one operation. Feeds in mm/min, depths in mm.
 */
export interface Feeds {
  feed: number;
  plunge: number;
  depthPerPass: number;
  rpm: number;
  /** Pocket ring spacing as a percentage of the bit diameter. */
  stepover: number;
}

export interface Material {
  id: string;
  name: string;
  /** Starting point for a 3.175 mm 2-flute flat end mill on a stock 3018. */
  base: Feeds;
}

/**
 * Conservative starting values for a ~10k RPM 775 spindle on a flexible frame
 * (SPEC.md §8). Tune these after test cuts; they're the single source of truth.
 */
export const MATERIALS: readonly Material[] = [
  {
    id: 'softwood',
    name: 'Softwood (pine)',
    base: { feed: 700, plunge: 250, depthPerPass: 1.0, rpm: 10000, stepover: 40 },
  },
  {
    id: 'hardwood',
    name: 'Hardwood (oak, maple, walnut)',
    base: { feed: 450, plunge: 150, depthPerPass: 0.5, rpm: 10000, stepover: 40 },
  },
  {
    id: 'mdf',
    name: 'MDF',
    base: { feed: 700, plunge: 250, depthPerPass: 1.0, rpm: 10000, stepover: 45 },
  },
  {
    id: 'plywood',
    name: 'Plywood (birch)',
    base: { feed: 550, plunge: 200, depthPerPass: 0.8, rpm: 10000, stepover: 40 },
  },
  {
    id: 'acrylic',
    name: 'Acrylic (cast)',
    base: { feed: 400, plunge: 120, depthPerPass: 0.5, rpm: 9000, stepover: 35 },
  },
  {
    id: 'hdpe',
    name: 'HDPE / plastics',
    base: { feed: 600, plunge: 200, depthPerPass: 1.0, rpm: 9000, stepover: 40 },
  },
  {
    id: 'aluminum',
    name: 'Aluminum (6061), expert',
    base: { feed: 150, plunge: 40, depthPerPass: 0.15, rpm: 10000, stepover: 20 },
  },
  {
    id: 'foam',
    name: 'Foam / soft wax',
    base: { feed: 1200, plunge: 400, depthPerPass: 3.0, rpm: 8000, stepover: 50 },
  },
];

export const DEFAULT_MATERIAL_ID = 'plywood';

export const findMaterial = (id: string): Material | undefined =>
  MATERIALS.find((m) => m.id === id);

const REFERENCE_DIAMETER = 3.175;
/** V-bits have a fragile point, so they move slower than a flat bit would. */
const VBIT_FEED_FACTOR = 0.6;

/** Preset feeds for a material + bit combination, before user overrides. */
export function presetFeeds(material: Material, bit: Bit): Feeds {
  const { base } = material;
  if (bit.type === 'vbit') {
    return { ...base, feed: Math.round(base.feed * VBIT_FEED_FACTOR) };
  }
  // Smaller flat bits break easily: scale feed and depth down, never above the preset.
  const ratio = Math.min(bit.diameter / REFERENCE_DIAMETER, 1);
  return {
    ...base,
    feed: Math.round(base.feed * ratio),
    depthPerPass: round2(Math.min(base.depthPerPass, base.depthPerPass * ratio)),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
