import type { MachineConfig } from '../machine/machineConfig';
import type { BitProgram, Move } from './program';

export interface ProgramStats {
  /** Optimistic: ignores acceleration, so real runs take ~10–20% longer. */
  seconds: number;
  cutLength: number;
  maxDepth: number;
  moveCount: number;
}

/** The tool starts every program at X0 Y0, touching the material. */
const START: Move = { kind: 'rapid', x: 0, y: 0, z: 0 };

export function estimateProgram(program: BitProgram, machine: MachineConfig): ProgramStats {
  let seconds = 0;
  let cutLength = 0;
  let maxDepth = 0;
  let moveCount = 0;
  let prev = START;
  let rpm: number | null = null;

  for (const section of program.sections) {
    if (section.rpm !== rpm) {
      if (!machine.manualSpindle) seconds += machine.spindleDwell; // spin-up (or speed change) dwell
      rpm = section.rpm;
    }
    for (const move of section.moves) {
      const xy = Math.hypot(move.x - prev.x, move.y - prev.y);
      const dz = Math.abs(move.z - prev.z);
      const length = Math.hypot(xy, dz);
      if (move.kind === 'feed') {
        seconds += (length / move.feed!) * 60;
        cutLength += length;
      } else {
        // GRBL rapids run each axis at its own max rate; the slower axis wins.
        seconds += Math.max(xy / machine.maxFeedXY, dz / machine.maxFeedZ) * 60;
      }
      maxDepth = Math.max(maxDepth, -move.z);
      moveCount++;
      prev = move;
    }
  }
  return { seconds, cutLength, maxDepth, moveCount };
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rest}s`;
  return `${rest}s`;
}
