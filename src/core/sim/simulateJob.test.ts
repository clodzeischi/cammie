import { generateJob } from '../cam/generateJob';
import { makeJob, makeObject, pocketOp, profileOp, square } from '../cam/testFixtures';
import type { Job, Operation } from '../job/job';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { findBit, grooveWidth } from '../tools/bits';
import { cellSize, isSolid, type HeightField } from './heightField';
import { findParts } from './looseParts';
import { simulateJob } from './simulateJob';

// Stock 100 × 50 × 6 mm; 0.1 mm cells.
const CELLS = 500_000;

/** A 20 mm square at canvas x 20..40, y 10..30, with these cuts. */
const job = (...ops: Array<Operation & { face?: 'bottom' }>): Job => {
  const base = makeJob(
    ops.map((op, i) =>
      makeObject({
        id: `o${i}`,
        paths: [square(0, 0, 20)],
        width: 20,
        height: 20,
        transform: { x: 20, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
        operation: op,
      }),
    ),
  );
  return {
    ...base,
    toolpaths: base.toolpaths.map((t, i) => (ops[i]!.face ? { ...t, face: 'bottom' } : t)),
  };
};

const simulate = (j: Job) => {
  const { programs, diagnostics } = generateJob(j, DEFAULT_MACHINE_CONFIG);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return simulateJob(j, programs, CELLS);
};

const at = (field: HeightField, x: number, y: number) => {
  const i = Math.floor(y / field.cell) * field.cols + Math.floor(x / field.cell);
  return { top: field.top[i]!, bottom: field.bottom[i]!, spoil: field.spoil[i]!, i };
};

/** Width (mm) of the cut crossing the row at canvas y, between x0 and x1. */
const cutWidth = (field: HeightField, y: number, x0: number, x1: number) => {
  let cells = 0;
  for (let x = x0; x < x1; x += field.cell) if (at(field, x, y).top < -0.005) cells++;
  return cells * field.cell;
};

describe('simulateJob', () => {
  it('sizes cells to the stock, within limits', () => {
    expect(cellSize({ width: 100, height: 50, thickness: 6 }, CELLS)).toBeCloseTo(0.1);
    expect(cellSize({ width: 1, height: 1, thickness: 6 })).toBe(0.05);
    expect(cellSize({ width: 3000, height: 3000, thickness: 6 })).toBe(0.5);
  });

  it('clears a pocket to its depth and leaves the rest alone', () => {
    const field = simulate(job(pocketOp({ depth: 3 })));
    expect(at(field, 30, 20).top).toBeCloseTo(-3);
    expect(at(field, 21, 11).top).toBeCloseTo(-3);
    expect(at(field, 10, 20).top).toBe(0);
    expect(at(field, 30, 20).bottom).toBe(-6);
  });

  it('cuts V and round grooves as wide as the bit makes them', () => {
    for (const bitId of ['vbit-60', 'round-3.175']) {
      const depth = bitId === 'vbit-60' ? 1 : 0.5;
      const field = simulate(job(profileOp({ bitId, depth })));
      const expected = grooveWidth(findBit(bitId)!, depth);
      // The left edge of the square runs down x = 20.
      expect(Math.abs(cutWidth(field, 20, 15, 25) - expected)).toBeLessThanOrEqual(2 * field.cell);
      expect(at(field, 20, 20).top).toBeCloseTo(-depth, 1);
    }
  });

  it('frees a part cut out without tabs, but not one held by tabs', () => {
    const cutOut = (enabled: boolean) =>
      profileOp({
        side: 'outside',
        bitId: 'flat-3.175',
        depth: 6.2,
        tabs: { ...profileOp().tabs, enabled },
      });
    const free = findParts(simulate(job(cutOut(false))));
    expect(free.loose).toHaveLength(1);
    expect(free.loose[0]).toMatchObject({ minCol: 200, maxCol: 399, minRow: 100, maxRow: 299 });
    expect(findParts(simulate(job(cutOut(true)))).loose).toEqual([]);
  });

  it("frees a hole's slug", () => {
    const hole = profileOp({
      side: 'inside',
      bitId: 'flat-3.175',
      depth: 6.2,
      tabs: { ...profileOp().tabs, enabled: false },
    });
    const field = simulate(job(hole));
    expect(findParts(field).loose).toHaveLength(1);
    // Cut through just inside the edge, 0.2 mm into the spoilboard.
    const groove = at(field, 21, 20);
    expect(isSolid(field, groove.i)).toBe(false);
    expect(groove.spoil).toBeCloseTo(0.2, 1);
  });

  it('cuts bottom pockets up from the bottom, where they sit on the design', () => {
    const field = simulate(job({ ...pocketOp({ depth: 2 }), face: 'bottom' }));
    expect(at(field, 30, 20).bottom).toBeCloseTo(-4);
    expect(at(field, 30, 20).top).toBe(0);
    expect(at(field, 10, 20).bottom).toBe(-6);
  });

  it('opens a hole where top and bottom pockets meet', () => {
    const field = simulate(
      job(pocketOp({ depth: 4.5 }), { ...pocketOp({ depth: 2 }), face: 'bottom' }),
    );
    expect(isSolid(field, at(field, 30, 20).i)).toBe(false);
    expect(findParts(field).loose).toEqual([]);
  });
});
