import type { Path } from '../geometry/path';
import { canCut } from '../job/bitCapabilities';
import { insertToolpath } from '../job/toolpaths';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { grblPost } from '../post/grbl/grblPost';
import { lintGcode } from '../post/grbl/lintGcode';
import { findBit } from '../tools/bits';
import { buildExportFiles } from '../../app/exportFiles';
import { generateJob } from './generateJob';
import { makeJob, makeObject, pocketOp, vcarveOp } from './testFixtures';
import { passRuns, simplify3 } from './vcarve/carveRuns';

const machine = { ...DEFAULT_MACHINE_CONFIG, spindleDwell: 0 };

const rect = (w: number, h: number): Path => ({
  closed: true,
  points: [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
});

/** A w × h rectangle at (10, 10) on the canvas, V-carved. */
const carved = (w: number, h: number, op = vcarveOp()) =>
  makeJob([makeObject({ paths: [rect(w, h)], width: w, height: h, operation: op })]);

const feeds = (job: ReturnType<typeof carved>) =>
  generateJob(job, machine).programs.flatMap((p) =>
    p.sections.flatMap((s) => s.moves.filter((m) => m.kind === 'feed')),
  );
const messages = (job: ReturnType<typeof carved>) =>
  generateJob(job, machine).diagnostics.map((d) => d.message);

describe('V-carve', () => {
  // 90° bit with a 0.2 mm tip: depth = distance to the edge − 0.1.
  it('carves deepest along the middle, as deep as the cone must go to touch both walls', () => {
    const job = carved(4, 2);
    const result = generateJob(job, machine);
    expect(result.carveDepths['tp-obj-1']).toBeCloseTo(0.9, 2);
    const moves = feeds(job);
    expect(Math.min(...moves.map((m) => m.z))).toBeCloseTo(-0.9, 2);
    // Origin bottom-left, stock 50 high: canvas (10..14, 10..12) → machine (10..14, 38..40).
    for (const m of moves) {
      expect(m.x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(m.x).toBeLessThanOrEqual(14 + 1e-6);
      expect(m.y).toBeGreaterThanOrEqual(38 - 1e-6);
      expect(m.y).toBeLessThanOrEqual(40 + 1e-6);
      // Never deeper than the cone can go there without cutting past the outline.
      const toEdge = Math.min(m.x - 10, 14 - m.x, m.y - 38, 40 - m.y);
      expect(-m.z).toBeLessThanOrEqual(Math.max(0, toEdge - 0.1) + 0.01);
    }
  });

  it('steps down in passes when it is deeper than the depth per pass', () => {
    // Plywood: 0.8 mm per pass, so a 0.9 mm carve takes two.
    const moves = feeds(carved(4, 2));
    const floors = new Set(moves.map((m) => Math.round(m.z * 100) / 100));
    expect(floors).toContain(-0.45);
    expect(floors).toContain(-0.9);
  });

  it('writes files that pass the G-code checker', () => {
    const job = carved(4, 2);
    const files = buildExportFiles(
      generateJob(job, machine).programs,
      job,
      machine,
      'Sign',
      grblPost,
    );
    expect(files).toHaveLength(1);
    expect(lintGcode(files[0]!.text, machine)).toEqual([]);
  });

  it('warns when it carves deeper than asked, or wider than the bit', () => {
    expect(messages(carved(4, 2, vcarveOp({ warnDepth: 0.5 })))).toEqual([
      expect.stringMatching(/carves up to 0\.9 mm deep, more than the 0\.5 mm/),
    ]);
    expect(messages(carved(4, 2))).toEqual([]);
    expect(messages(carved(20, 10))).toContainEqual(
      expect.stringMatching(/up to 10 mm wide, more than the V-bit 90° can carve/),
    );
  });

  it("says when a shape is too thin for the bit's tip", () => {
    expect(messages(carved(4, 0.15))).toContainEqual(
      expect.stringMatching(/narrower than the V-bit 90°'s 0\.2 mm tip/),
    );
  });

  it('needs a V-bit and closed shapes', () => {
    expect(canCut(findBit('vbit-60')!, 'vcarve')).toBe(true);
    expect(canCut(findBit('flat-3.175')!, 'vcarve')).toBe(false);
    const open = makeObject({
      paths: [
        {
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
          ],
        },
      ],
      operation: vcarveOp(),
    });
    expect(messages(makeJob([open]))).toEqual([expect.stringMatching(/has only open lines/)]);
  });

  it('runs before pockets', () => {
    const list = insertToolpath([{ id: 'p', objectId: 'a', operation: pocketOp() }], {
      id: 'v',
      objectId: 'b',
      operation: vcarveOp(),
    });
    expect(list.map((t) => t.id)).toEqual(['v', 'p']);
  });
});

describe('passRuns', () => {
  const line = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: -2 },
    { x: 2, y: 0, z: 0 },
  ];

  it('flattens a pass at its floor, keeping the true slope down to it', () => {
    expect(passRuns(line, 0, -1)).toEqual([
      [
        { x: 0, y: 0, z: 0 },
        { x: 0.5, y: 0, z: -1 },
        { x: 1, y: 0, z: -1 },
        { x: 1.5, y: 0, z: -1 },
        { x: 2, y: 0, z: 0 },
      ],
    ]);
  });

  it('takes later passes only where the last one could not reach', () => {
    expect(passRuns(line, -1, -2)).toEqual([
      [
        { x: 0.5, y: 0, z: -1 },
        { x: 1, y: 0, z: -2 },
        { x: 1.5, y: 0, z: -1 },
      ],
    ]);
  });
});

describe('simplify3', () => {
  it('drops points on a straight 3D line, keeps corners', () => {
    const points = [0, 1, 2, 3, 4].map((i) => ({ x: i, y: 0, z: -i / 4 }));
    expect(simplify3(points)).toEqual([points[0], points[4]]);
    const bent = [...points, { x: 4, y: 3, z: -1 }];
    expect(simplify3(bent)).toHaveLength(3);
  });
});
