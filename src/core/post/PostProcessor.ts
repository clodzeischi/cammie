import type { BitProgram } from '../cam/program';
import type { MachineConfig } from '../machine/machineConfig';

/** Context printed into the file header; doesn't change the toolpaths. */
export interface PostContext {
  machine: MachineConfig;
  fileName: string;
  materialName: string;
  stock: { width: number; height: number; thickness: number };
  originLabel: string;
  /** 1-based position of this file among the job's files. */
  fileIndex: number;
  fileCount: number;
  /** What to do at the machine before running this file; defaults to changing the bit. */
  setupNote?: string;
  estimatedSeconds: number;
  appVersion: string;
}

/** Turns machine-agnostic toolpaths into controller-specific text (SPEC.md §12.4). */
export interface PostProcessor {
  readonly id: string;
  readonly fileExtension: string;
  render(program: BitProgram, context: PostContext): string;
}
