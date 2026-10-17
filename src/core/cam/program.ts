import type { Bit } from '../tools/bits';

/**
 * Machine-agnostic toolpaths. Coordinates are machine coordinates in mm
 * (origin anchor = X0 Y0, top of material = Z0, Y up). A post-processor
 * turns these into text for a specific controller.
 */
export interface Move {
  kind: 'rapid' | 'feed';
  x: number;
  y: number;
  z: number;
  /** mm/min; required for feed moves. */
  feed?: number;
}

/**
 * The cuts for one design object. A section starts and ends with the tool at
 * safe Z, so sections can be run in any order.
 */
export interface ProgramSection {
  label: string;
  rpm: number;
  moves: Move[];
}

/** Everything cut with one bit, i.e. one `.nc` file. */
export interface BitProgram {
  bit: Bit;
  sections: ProgramSection[];
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  objectId?: string;
}

export interface GeneratedJob {
  programs: BitProgram[];
  diagnostics: Diagnostic[];
}

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.some((d) => d.severity === 'error');
