import type { BitProgram } from '../cam/program';
import { cutFrame } from '../job/faces';
import type { Job } from '../job/job';
import { carveMove, type ToolPoint } from './carve';
import { createHeightField, type HeightField } from './heightField';
import { toolShape } from './toolShape';

/**
 * Runs every file, in order, on fresh stock and returns what's left. Moves
 * are taken back to the design's view through each face's frame, so bottom
 * files land mirrored exactly as they'll be cut.
 */
export function simulateJob(
  job: Pick<Job, 'stock' | 'origin' | 'flip'>,
  programs: readonly BitProgram[],
  maxCells?: number,
): HeightField {
  const field = createHeightField(job.stock, maxCells);
  for (const program of programs) {
    const frame = cutFrame(job, program.face);
    const tool = toolShape(program.bit);
    let previous: ToolPoint | null = null;
    for (const section of program.sections) {
      for (const move of section.moves) {
        const p = frame.toCanvas(move);
        const point = { x: p.x, y: p.y, z: move.z };
        if (previous) carveMove(field, tool, program.face, previous, point);
        previous = point;
      }
    }
  }
  return field;
}
