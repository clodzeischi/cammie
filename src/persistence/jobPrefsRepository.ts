import type { OriginAnchor, Stock } from '../core/job/job';
import { DEFAULT_MATERIAL_ID, findMaterial } from '../core/materials/materials';
import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

/** The parts of a job worth remembering between visits (SPEC.md §13.4). */
export interface JobPrefs {
  stock: Stock;
  origin: OriginAnchor;
  materialId: string;
}

export const JOB_PREFS_KEY = 'cammie.prefs.v1';

export const DEFAULT_JOB_PREFS: JobPrefs = {
  stock: { width: 200, height: 150, thickness: 6 },
  origin: 'bottom-left',
  materialId: DEFAULT_MATERIAL_ID,
};

export const ORIGIN_ANCHORS: readonly OriginAnchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const positive = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

export function reviveJobPrefs(stored: unknown): JobPrefs {
  const d = DEFAULT_JOB_PREFS;
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const stock = (typeof s.stock === 'object' && s.stock !== null ? s.stock : {}) as Record<
    string,
    unknown
  >;

  return {
    stock: {
      width: positive(stock.width, d.stock.width),
      height: positive(stock.height, d.stock.height),
      thickness: positive(stock.thickness, d.stock.thickness),
    },
    origin: ORIGIN_ANCHORS.includes(s.origin as OriginAnchor)
      ? (s.origin as OriginAnchor)
      : d.origin,
    materialId:
      typeof s.materialId === 'string' && findMaterial(s.materialId) ? s.materialId : d.materialId,
  };
}

export function createJobPrefsRepository(store: KeyValueStore): Repository<JobPrefs> {
  return createVersionedRepository(store, {
    key: JOB_PREFS_KEY,
    version: 1,
    defaults: () => structuredClone(DEFAULT_JOB_PREFS),
    revive: (stored) => reviveJobPrefs(stored),
  });
}
