import { boundsOfPaths } from '../geometry/path';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { generateJob } from './generateJob';
import { pocketRings } from './pocket';
import { makeJob, makeObject, pocketOp, profileOp, square } from './testFixtures';
import { Loop } from './toolpath/loop';
import { loopPass } from './toolpath/loopPass';
import { autoTabCount, autoTabPositions } from './toolpath/tabs';

const machine = DEFAULT_MACHINE_CONFIG;
const allMoves = (job: ReturnType<typeof makeJob>) =>
  generateJob(job, machine).programs.flatMap((p) => p.sections.flatMap((s) => s.moves));

describe('loopPass with tabs', () => {
  const loop = new Loop(square(0, 0, 40)); // 160 mm perimeter

  it('lifts to the tab top over each tab, with vertical moves at the edges', () => {
    const { vertices } = loopPass({
      loop,
      start: 0,
      fromZ: -5,
      toZ: -6,
      rampLength: 0,
      tabs: [[50, 60]],
      tabZ: -4.5,
    });
    // 50–60 mm along the loop is on the right edge (x = 40), y from 10 to 20.
    const overTab = vertices.filter((v) => v.z === -4.5);
    expect(overTab.length).toBeGreaterThan(0);
    overTab.forEach((v) => {
      expect(v.x).toBeCloseTo(40);
      expect(v.y).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(v.y).toBeLessThanOrEqual(20 + 1e-9);
    });
    expect(Math.min(...vertices.map((v) => v.z))).toBe(-6);
    // Entering and leaving the tab are straight up and down.
    const up = vertices.findIndex((v) => v.z === -4.5);
    expect(vertices[up]!.x).toBeCloseTo(vertices[up - 1]!.x);
    expect(vertices[up]!.y).toBeCloseTo(vertices[up - 1]!.y);
  });

  it('leaves passes above the tab top alone', () => {
    const { vertices } = loopPass({
      loop,
      start: 0,
      fromZ: 0,
      toZ: -1,
      rampLength: 0,
      tabs: [[50, 60]],
      tabZ: -4.5,
    });
    expect(new Set(vertices.slice(1).map((v) => v.z))).toEqual(new Set([-1]));
  });

  it('wraps a long ramp round a small loop', () => {
    const small = new Loop(square(0, 0, 2)); // 8 mm perimeter
    const { vertices, end } = loopPass({
      loop: small,
      start: 0,
      fromZ: 0,
      toZ: -1,
      rampLength: 20,
      tabs: [],
      tabZ: -Infinity,
    });
    expect(end).toBe(28);
    expect(vertices.at(-1)!.z).toBe(-1);
    for (let i = 1; i < vertices.length; i++)
      expect(vertices[i]!.z).toBeLessThanOrEqual(vertices[i - 1]!.z);
  });
});

describe('auto tabs', () => {
  it('scales the count with loop length and keeps space between tabs', () => {
    expect(autoTabCount(160, 7)).toBe(3);
    expect(autoTabCount(600, 7)).toBe(6);
    expect(autoTabCount(2000, 7)).toBe(8);
    expect(autoTabCount(20, 7)).toBe(1);
  });

  it('moves tabs off corners onto straight edges', () => {
    const loop = new Loop(square(0, 0, 40));
    // Four tabs would land at 20, 60, 100, 140 mm: mid-edge already, so they stay put.
    expect(autoTabPositions(loop, 4, 7)).toEqual([20, 60, 100, 140]);
    // Three tabs at 26.7 + k·53.3 put the second near the 80 mm corner; it gets nudged away.
    const [, second] = autoTabPositions(loop, 3, 7);
    expect(Math.abs(second! - 80)).toBeGreaterThan(3.5);
  });
});

describe('profile tabs and finishing in a job', () => {
  const part = (changes = {}) =>
    makeObject({
      paths: [square(0, 0, 40)],
      width: 40,
      height: 40,
      transform: { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 },
      operation: profileOp({ side: 'outside', bitId: 'flat-3.175', depth: 6.2, ...changes }),
    });

  it('adds tabs to through cuts and keeps the tool at the tab top over them', () => {
    const job = makeJob([part()]);
    const result = generateJob(job, machine);
    expect(result.diagnostics.filter((d) => d.message.includes('no tabs'))).toEqual([]);
    expect(result.tabs[0]!.centres).toHaveLength(3);
    const zs = new Set(allMoves(job).map((m) => Number(m.z.toFixed(3))));
    expect(zs.has(-4.5)).toBe(true); // 6 mm stock, 1.5 mm tabs
    expect(zs.has(-6.2)).toBe(true);
  });

  it('hand-placed tabs replace the automatic ones', () => {
    const tabs = { ...profileOp().tabs, manual: [{ x: 20, y: -1.6 }] }; // top edge, object space
    const result = generateJob(makeJob([part({ tabs })]), machine);
    expect(result.tabs[0]!.centres).toHaveLength(1);
  });

  it('finishing: roughs at the allowance, then finishes at the true size', () => {
    const job = makeJob([
      part({
        finishing: { enabled: true, allowance: 0.5 },
        tabs: { ...profileOp().tabs, enabled: false },
      }),
    ]);
    const xs = allMoves(job)
      .filter((m) => m.z < 0)
      .map((m) => m.x);
    const r = 3.175 / 2;
    expect(Math.min(...xs)).toBeCloseTo(5 - r - 0.5, 2); // rough
    expect(xs.some((x) => Math.abs(x - (5 - r)) < 0.01)).toBe(true); // finish
  });
});

describe('pockets', () => {
  // 30 mm square pocket with a 10 mm island in the middle.
  const shape = [square(0, 0, 30), square(10, 10, 10)];

  it('rings start one radius in from the walls and leave the island', () => {
    const rings = pocketRings(shape, 3, 40, 0, 'climb');
    expect(boundsOfPaths(rings.levels[0]!)).toEqual({
      minX: 1.5,
      minY: 1.5,
      maxX: 28.5,
      maxY: 28.5,
    });
    const islandRing = rings.levels[0]!.find((p) => boundsOfPaths([p]).minX > 5)!;
    expect(boundsOfPaths([islandRing])).toEqual({ minX: 8.5, minY: 8.5, maxX: 21.5, maxY: 21.5 });
    expect(rings.step).toBeCloseTo(1.2);
  });

  it('clears to depth in passes, innermost first, and never enters the island', () => {
    const job = makeJob([
      makeObject({
        paths: shape,
        width: 30,
        height: 30,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        operation: pocketOp({ depth: 2 }),
      }),
    ]);
    const { programs, diagnostics } = generateJob(job, machine);
    expect(diagnostics).toEqual([]);
    const moves = programs[0]!.sections[0]!.moves;
    expect(programs[0]!.sections[0]!.label).toBe('Pocket: Logo');
    expect(Math.min(...moves.map((m) => m.z))).toBe(-2);
    // Island occupies canvas 10..20 → machine x 10..20, y 30..40 (stock 50 tall).
    // The tool centre must stay at least one radius from it.
    const r = 3.175 / 2;
    const distanceToIsland = (x: number, y: number) =>
      Math.hypot(Math.max(10 - x, 0, x - 20), Math.max(30 - y, 0, y - 40));
    for (const m of moves.filter((mv) => mv.z < 0)) {
      expect(distanceToIsland(m.x, m.y)).toBeGreaterThan(r - 0.01);
    }
  });

  it('rejects V-bits and warns when the pocket is too small', () => {
    const vbit = makeJob([makeObject({ operation: pocketOp({ bitId: 'vbit-60' }) })]);
    expect(generateJob(vbit, machine).diagnostics[0]!.severity).toBe('error');
    const tiny = makeJob([makeObject({ paths: [square(0, 0, 2)], operation: pocketOp() })]);
    expect(generateJob(tiny, machine).diagnostics[0]!.message).toContain('too small');
  });

  it('keeps ring vertex counts flat instead of growing ring by ring', () => {
    // Regression: offsetting each ring from the previous one re-rounded every
    // corner, so a 1 mm bit through-pocket made ~800k moves and froze the page.
    const circle = {
      closed: true,
      points: Array.from({ length: 64 }, (_, i) => ({
        x: 20 + 6 * Math.cos((i / 64) * 2 * Math.PI),
        y: 20 + 6 * Math.sin((i / 64) * 2 * Math.PI),
      })),
    };
    const { levels } = pocketRings([square(0, 0, 40), circle], 1, 40, 0, 'climb');
    const vertices = levels.map((ring) => ring.reduce((n, p) => n + p.points.length, 0));
    expect(Math.max(...vertices)).toBeLessThan(400);
  });
});
