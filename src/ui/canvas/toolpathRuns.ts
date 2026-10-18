import type { BitProgram } from '../../core/cam/program';
import type { Vec2 } from '../../core/geometry/path';
import { machineToCanvas } from '../../core/job/job';
import { grooveWidth } from '../../core/tools/bits';

/**
 * A stretch of consecutive moves of one kind, flattened to canvas
 * coordinates for drawing. Move indices are counted across the whole program.
 */
export interface ToolpathRun {
  kind: 'feed' | 'rapid';
  /** [x0, y0, x1, y1, …]; starts at the position before the first move. */
  points: number[];
  /** Index of the first move in this run. */
  firstMove: number;
  moveCount: number;
  /** Groove width at the surface (mm), for "show cut width". */
  width: number;
}

export interface ProgramPreview {
  runs: ToolpathRun[];
  moveCount: number;
  /** Canvas position of the tool after each move; [0] is the start. */
  positions: Vec2[];
}

export function buildPreview(program: BitProgram, origin: Vec2): ProgramPreview {
  const runs: ToolpathRun[] = [];
  const positions: Vec2[] = [machineToCanvas({ x: 0, y: 0 }, origin)];
  let index = 0;
  let current: ToolpathRun | null = null;

  for (const section of program.sections) {
    // reduce, not Math.max(...moves): big programs overflow the argument stack.
    const depth = section.moves.reduce((deepest, m) => Math.max(deepest, -m.z), 0);
    const width = grooveWidth(program.bit, depth);
    for (const move of section.moves) {
      const from = positions[positions.length - 1]!;
      const to = machineToCanvas(move, origin);
      if (!current || current.kind !== move.kind) {
        current = {
          kind: move.kind,
          points: [from.x, from.y],
          firstMove: index,
          moveCount: 0,
          width,
        };
        runs.push(current);
      }
      current.points.push(to.x, to.y);
      current.moveCount++;
      positions.push(to);
      index++;
    }
  }
  return { runs, moveCount: index, positions };
}

/** The part of each run already "cut" after `done` moves (for the scrubber). */
export function completedRuns(preview: ProgramPreview, done: number): ToolpathRun[] {
  const result: ToolpathRun[] = [];
  for (const run of preview.runs) {
    if (run.firstMove >= done) break;
    const moves = Math.min(run.moveCount, done - run.firstMove);
    result.push(
      moves === run.moveCount
        ? run
        : { ...run, moveCount: moves, points: run.points.slice(0, (moves + 1) * 2) },
    );
  }
  return result;
}
