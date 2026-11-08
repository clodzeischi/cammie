import type { BitProgram } from '../cam/program';
import { cutFrame, type Job } from '../job/job';
import { carveMove, type ToolPoint } from './carve';
import { createHeightField, type HeightField } from './heightField';
import { toolShape } from './toolShape';

/**
 * Runs every file, in order, on fresh stock and returns what's left. Moves
 * are taken back to the design's view (canvas coordinates).
 */
export function simulateJob(
  job: Pick<Job, 'stock' | 'origin'>,
  programs: readonly BitProgram[],
  maxCells?: number,
): HeightField {
  const field = createHeightField(job.stock, maxCells);
  const frame = cutFrame(job);
  for (const program of programs) {
    const tool = toolShape(program.bit);
    let previous: ToolPoint | null = null;
    for (const section of program.sections) {
      for (const move of section.moves) {
        const p = frame.toCanvas(move);
        const point = { x: p.x, y: p.y, z: move.z };
        if (previous) carveMove(field, tool, previous, point);
        previous = point;
      }
    }
  }
  return field;
}
