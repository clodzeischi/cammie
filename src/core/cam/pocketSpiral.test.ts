import { describe, expect, it } from 'vitest';
import { ellipsePath, rectPath } from '../shapes/primitives';
import type { Path } from '../geometry/path';
import { cutPocket, pocketRings } from './pocket';
import { MoveWriter } from './toolpath/moveWriter';

const SAFE_Z = 5;
const feeds = { feed: 400, plunge: 100, depthPerPass: 1, rpm: 10000, stepover: 40 };

/** Times the tool rises to safe Z (the first move up from the start counts too). */
function liftsFor(path: Path, stepover: number, entry: 'ramp' | 'plunge', depths: number[]) {
  const writer = new MoveWriter(SAFE_Z, feeds, { x: 0, y: 0 });
  cutPocket(writer, { rings: pocketRings([path], 3, stepover, 0, 'climb'), depths, entry });
  return writer.moves.filter(
    (m, i) => m.kind === 'rapid' && m.z === SAFE_Z && writer.moves[i - 1]?.z !== SAFE_Z,
  ).length;
}

describe('pocket spiral', () => {
  // Regression: rings were joined only at their corners, so after a ramp ended
  // part-way along a side the nearest corner was too far and the tool lifted
  // and restarted elsewhere, on every ring of a rectangle.
  const shapes: Array<[string, Path, number]> = [
    ['rectangle', rectPath(60, 40), 40],
    ['rounded rectangle, fine stepover', rectPath(60, 40, 5), 20],
    ['long thin rectangle', rectPath(80, 30, 3), 45],
    ['ellipse', ellipsePath(70, 30), 40],
  ];
  for (const [name, path, stepover] of shapes) {
    for (const entry of ['ramp', 'plunge'] as const) {
      it(`clears a ${name} in one unbroken spiral per depth (${entry})`, () => {
        // One approach at the start, then one retract after each of the two depths.
        expect(liftsFor(path, stepover, entry, [1, 2])).toBe(3);
      });
    }
  }
});
