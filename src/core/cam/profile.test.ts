import { boundsOfPaths, signedArea, type Path } from '../geometry/path';
import type { DesignObject, ProfileOperation } from '../job/job';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { generateJob } from './generateJob';
import { profilePaths } from './profile';
import { makeJob, makeObject, profileOp, square } from './testFixtures';

const ccw = (p: Path) => signedArea(p.points) > 0;
const frame = [square(0, 0, 20), square(5, 5, 10)]; // 20 mm square with a 10 mm hole

describe('profilePaths', () => {
  it('outside: tool centre one radius outside the shape and around the hole', () => {
    const { paths, lostDetail } = profilePaths(frame, 'outside', 2);
    expect(lostDetail).toBe(false);
    expect(boundsOfPaths(paths)).toEqual({ minX: -1, minY: -1, maxX: 21, maxY: 21 });
    const hole = paths.find((p) => boundsOfPaths([p]).minX > 0)!;
    expect(boundsOfPaths([hole])).toEqual({ minX: 6, minY: 6, maxX: 14, maxY: 14 });
  });

  it('inside: tool centre one radius inside', () => {
    const { paths } = profilePaths([square(0, 0, 20)], 'inside', 2);
    expect(boundsOfPaths(paths)).toEqual({ minX: 1, minY: 1, maxX: 19, maxY: 19 });
  });

  it('climbs: outside loops clockwise, inside loops counter-clockwise (Y up)', () => {
    const outside = profilePaths([square(0, 0, 20)], 'outside', 2).paths[0]!;
    const inside = profilePaths([square(0, 0, 20)], 'inside', 2).paths[0]!;
    expect(ccw(outside)).toBe(false);
    expect(ccw(inside)).toBe(true);
    // The hole of an outside cut keeps the part on the right too: counter-clockwise.
    const hole = profilePaths(frame, 'outside', 2).paths.find((p) => boundsOfPaths([p]).minX > 0)!;
    expect(ccw(hole)).toBe(true);
  });

  it('conventional reverses the direction', () => {
    const outside = profilePaths([square(0, 0, 20)], 'outside', 2, 'conventional').paths[0]!;
    expect(ccw(outside)).toBe(true);
  });

  it('flags details too small for the bit', () => {
    const result = profilePaths([square(0, 0, 20), square(40, 0, 1)], 'inside', 2);
    expect(result.paths).toHaveLength(1);
    expect(result.lostDetail).toBe(true);
  });

  it('on the line returns the paths untouched', () => {
    const open: Path = {
      closed: false,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    };
    expect(profilePaths([open], 'on', 3).paths).toEqual([open]);
  });
});

const cutOut = (changes: Partial<ProfileOperation> = {}): DesignObject =>
  makeObject({
    id: 'part',
    name: 'Part',
    operation: profileOp({ side: 'outside', bitId: 'flat-3.175', depth: 3, ...changes }),
  });

describe('generateJob with profiles', () => {
  it('cuts outside the part by the bit radius', () => {
    const { programs, diagnostics } = generateJob(makeJob([cutOut()]), DEFAULT_MACHINE_CONFIG);
    expect(diagnostics).toEqual([]);
    const xs = programs[0]!.sections[0]!.moves.map((m) => m.x);
    expect(Math.min(...xs)).toBeCloseTo(10 - 3.175 / 2, 2);
    expect(Math.max(...xs)).toBeCloseTo(20 + 3.175 / 2, 2);
  });

  it('runs V-bit engraving first, then holes, then the cut-out in its own file', () => {
    const job = makeJob([
      cutOut(),
      makeObject({
        id: 'hole',
        name: 'Hole',
        operation: profileOp({ side: 'inside', bitId: 'flat-3.175', depth: 3 }),
      }),
      makeObject({ id: 'text', name: 'Text' }),
    ]);
    const { programs } = generateJob(job, DEFAULT_MACHINE_CONFIG);
    expect(programs.map((p) => p.bit.id)).toEqual(['flat-3.175', 'vbit-60']);
    expect(programs[0]!.sections.map((s) => s.label)).toEqual(['Inside: Hole', 'Outside: Part']);
  });

  it('rejects inside/outside with a V-bit, and open-only shapes', () => {
    const open = makeObject({
      id: 'line',
      name: 'Line',
      paths: [
        {
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        },
      ],
      operation: profileOp({ side: 'outside', bitId: 'flat-2', depth: 1 }),
    });
    const job = makeJob([cutOut({ bitId: 'vbit-60' }), open]);
    const errors = generateJob(job, DEFAULT_MACHINE_CONFIG).diagnostics.filter(
      (d) => d.severity === 'error',
    );
    expect(errors.map((e) => e.objectId)).toEqual(['part', 'line']);
  });

  it('warns about through cuts with tabs off, and greedy depth per pass', () => {
    const job = makeJob([cutOut({ depth: 6.2, tabs: { ...profileOp().tabs, enabled: false } })]);
    const overrides = { 'plywood|flat-3.175': { depthPerPass: 2 } };
    const messages = generateJob(job, DEFAULT_MACHINE_CONFIG, undefined, overrides).diagnostics.map(
      (d) => d.message,
    );
    expect(messages.some((m) => m.includes('half the bit'))).toBe(true);
    expect(messages.some((m) => m.includes('all the way through'))).toBe(true);
  });

  it('lets through cuts skim the spoilboard without a warning', () => {
    const skim = generateJob(makeJob([cutOut({ depth: 6.2 })]), DEFAULT_MACHINE_CONFIG);
    expect(skim.diagnostics.some((d) => d.message.includes('spoilboard'))).toBe(false);
    const deep = generateJob(makeJob([cutOut({ depth: 7 })]), DEFAULT_MACHINE_CONFIG);
    expect(deep.diagnostics.some((d) => d.message.includes('1 mm into the spoilboard'))).toBe(true);
  });

  it('warns when the whole shape is too small for the bit', () => {
    const tiny = makeObject({
      paths: [square(0, 0, 1)],
      width: 1,
      height: 1,
      operation: profileOp({ side: 'inside', bitId: 'flat-2', depth: 1 }),
    });
    const { programs, diagnostics } = generateJob(makeJob([tiny]), DEFAULT_MACHINE_CONFIG);
    expect(programs).toEqual([]);
    expect(diagnostics[0]!.message).toContain('too small');
  });
});
