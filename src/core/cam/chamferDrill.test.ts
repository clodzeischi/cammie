import { boundsOfPoints, type Path } from '../geometry/path';
import { fitsEasyMode, insertToolpath } from '../job/toolpaths';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { grblPost } from '../post/grbl/grblPost';
import { lintGcode } from '../post/grbl/lintGcode';
import { generateJob } from './generateJob';
import type { Move } from './program';
import {
  chamferOp,
  drillOp,
  makeJob,
  makeObject,
  pocketOp,
  profileOp,
  square,
} from './testFixtures';

const machine = { ...DEFAULT_MACHINE_CONFIG, spindleDwell: 0 };
const cutMoves = (moves: Move[]) => moves.filter((m) => m.kind === 'feed' && m.z < 0);

/** A circle-ish closed path of radius `r` around (cx, cy). */
const circle = (cx: number, cy: number, r: number): Path => ({
  closed: true,
  points: Array.from({ length: 32 }, (_, i) => ({
    x: cx + r * Math.cos((i / 32) * 2 * Math.PI),
    y: cy + r * Math.sin((i / 32) * 2 * Math.PI),
  })),
});

describe('chamfer', () => {
  it("runs the V-bit's tip just outside a part's edge, down to the depth for the width", () => {
    const job = makeJob([makeObject({ paths: [square(0, 0, 20)], operation: chamferOp() })]);
    const { programs, diagnostics } = generateJob(job, machine);
    expect(diagnostics).toEqual([]);
    const moves = cutMoves(programs[0]!.sections[0]!.moves);
    // Object at canvas (10, 10), 20 mm square; origin bottom-left of a 50 mm tall stock.
    // The 0.2 mm tip's flat sits 0.1 mm outside the edge.
    const b = boundsOfPoints(moves);
    expect(b.minX).toBeCloseTo(9.9);
    expect(b.maxX).toBeCloseTo(30.1);
    expect(Math.min(...moves.map((m) => m.z))).toBeCloseTo(-1);
  });

  it('keeps the tip inside the edge when bevelling the rim of a hole', () => {
    const job = makeJob([
      makeObject({ paths: [square(0, 0, 20)], operation: chamferOp({ side: 'inside' }) }),
    ]);
    const b = boundsOfPoints(cutMoves(generateJob(job, machine).programs[0]!.sections[0]!.moves));
    expect(b.minX).toBeCloseTo(10.1);
    expect(b.maxX).toBeCloseTo(29.9);
  });

  it('refuses chamfers wider than the cone and bits that are not V-bits', () => {
    const job = makeJob([
      makeObject({ id: 'a', operation: chamferOp({ depth: 5 }) }),
      makeObject({ id: 'b', operation: chamferOp({ bitId: 'flat-3.175' }) }),
    ]);
    const errors = generateJob(job, machine).diagnostics.map((d) => d.message);
    expect(errors).toEqual([
      expect.stringMatching(/wider than the V-bit 90° can cut \(1\.49 mm at most\)/),
      'Logo: Chamfers need a V-bit. Pick one for this cut.',
    ]);
  });
});

describe('drill', () => {
  const twoHoles = makeObject({
    paths: [circle(5, 5, 1.5), circle(25, 5, 1.5)],
    width: 30,
    height: 10,
    operation: drillOp(),
  });

  it('pecks down at the centre of each shape, clearing chips above the surface', () => {
    const { programs, diagnostics } = generateJob(makeJob([twoHoles]), machine);
    expect(diagnostics).toEqual([]);
    const moves = programs[0]!.sections[0]!.moves;
    // Plywood pecks 0.8 mm at a time: 2 mm takes 3 pecks per hole.
    const pecks = cutMoves(moves);
    const round = (v: number) => Math.round(v * 1000) / 1000;
    expect(pecks.map((m) => round(m.x))).toEqual([15, 15, 15, 35, 35, 35]);
    expect(pecks.map((m) => round(m.z))).toEqual([-0.667, -1.333, -2, -0.667, -1.333, -2]);
    expect(pecks.every((m) => m.feed === 200)).toBe(true);
    // Never a rapid into the material.
    expect(moves.filter((m) => m.kind === 'rapid').every((m) => m.z >= 0)).toBe(true);
  });

  it('notes that shapes bigger than the bit only get a bit-sized hole', () => {
    const job = makeJob([makeObject({ paths: [square(0, 0, 20)], operation: drillOp() })]);
    expect(generateJob(job, machine).diagnostics.map((d) => d.message)).toEqual([
      expect.stringMatching(/drills one 3.175 mm hole .* use Profile inside/),
    ]);
  });

  it('writes G-code that passes the linter', () => {
    const { programs } = generateJob(makeJob([twoHoles]), machine);
    const gcode = grblPost.render(programs[0]!, {
      machine,
      fileName: 'holes.nc',
      materialName: 'Plywood',
      stock: { width: 100, height: 50, thickness: 6 },
      originLabel: 'bottom left',
      fileIndex: 1,
      fileCount: 1,
      estimatedSeconds: 60,
      appVersion: 'test',
    });
    expect(lintGcode(gcode, machine)).toEqual([]);
  });
});

describe('cut order', () => {
  it('drills first and chamfers before parts are cut free', () => {
    const tp = (id: string, operation: Parameters<typeof insertToolpath>[1]['operation']) => ({
      id,
      objectId: 'o',
      operation,
    });
    const list = [
      tp('out', profileOp({ side: 'outside' })),
      tp('chamfer', chamferOp()),
      tp('pocket', pocketOp()),
      tp('drill', drillOp()),
    ].reduce(insertToolpath, []);
    expect(list.map((t) => t.id)).toEqual(['drill', 'pocket', 'chamfer', 'out']);
  });

  it('treats chamfers and drilling as Pro jobs', () => {
    expect(fitsEasyMode(makeJob([makeObject({ operation: chamferOp() })]))).toBe(false);
    expect(fitsEasyMode(makeJob([makeObject({ operation: pocketOp() })]))).toBe(true);
  });
});
