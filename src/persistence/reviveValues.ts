/** Small type guards for reading untrusted JSON (project files, stored preferences). */

export type Loose = Record<string, unknown>;

export const isObject = (v: unknown): v is Loose =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const str = (v: unknown): v is string => typeof v === 'string';
export const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  options.includes(v as T);
