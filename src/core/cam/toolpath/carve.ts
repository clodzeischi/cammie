import type { Vertex3 } from './loopPass';
import type { MoveWriter } from './moveWriter';
import { carveLines, passRuns, simplify3 } from '../vcarve/carveRuns';

export interface CarveParams {
  /** Centre lines with their full carve depth (negative Z), machine coordinates. */
  chains: Vertex3[][];
  /** Floor of each pass (positive mm), the last one the deepest point. */
  levels: number[];
}

const continues = (here: Vertex3, next: Vertex3) =>
  Math.hypot(here.x - next.x, here.y - next.y) < 1e-6 && Math.abs(here.z - next.z) < 1e-6;

/**
 * V-carving: the tool follows each centre line with Z varying (SPEC.md §9.5).
 * Each piece (letter) is carved completely before the next: its first pass
 * follows every line, later passes only the stretches the last one couldn't
 * reach. Runs that start where the tool already is carry on without lifting.
 */
export function cutCarve(writer: MoveWriter, { chains, levels }: CarveParams): void {
  const here = writer.position;
  for (const piece of carveLines(chains, { x: here.x, y: here.y })) {
    const lines = piece.map((line) => simplify3(line));
    levels.forEach((level, k) => {
      const above = k === 0 ? 0 : -levels[k - 1]!;
      for (const line of lines) {
        for (const run of passRuns(line, above, -level)) {
          if (writer.atSafeZ || !continues(writer.position, run[0]!)) {
            writer.approach(run[0]!, Math.min(run[0]!.z, 0));
          }
          writer.follow(run);
        }
      }
    });
    writer.retract();
  }
}
