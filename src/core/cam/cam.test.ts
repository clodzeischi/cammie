import type { Path } from '../geometry/path';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { estimateProgram } from './estimate';
import { generateJob } from './generateJob';
import { orderPaths } from './ordering';
import { makeJob, makeObject, profileOp, square } from './testFixtures';
import { cutLoops } from './toolpath/cutLoops';
import { MoveWriter } from './toolpath/moveWriter';
import { passDepths } from './toolpath/passes';

const feeds = { feed: 300, plunge: 100, depthPerPass: 0.5, rpm: 10000, stepover: 40 };
const line: Path = {
  closed: false,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
};

describe('passDepths', () => {
  it('splits into equal passes no deeper than depth per pass', () => {
    expect(passDepths(1, 0.5)).toEqual([0.5, 1]);
    expect(passDepths(1, 0.4)).toEqual([1 / 3, 2 / 3, 1]);
    expect(passDepths(0.3, 0.5)).toEqual([0.3]);
  });
});

describe('cutLoops', () => {
  const cut = (paths: Path[], entry: 'ramp' | 'plunge') => {
    const writer = new MoveWriter(5, feeds, { x: 0, y: 0 });
    cutLoops(writer, { paths, depths: [0.5, 1], entry, tabs: null });
    return writer.moves;
  };

  it('plunges and goes round a closed loop once per pass, ending at safe Z', () => {
    const moves = cut([square(0, 0)], 'plunge');
    expect(moves[0]).toEqual({ kind: 'rapid', x: 0, y: 0, z: 5 });
    expect(moves[1]).toEqual({ kind: 'rapid', x: 0, y: 0, z: 0.5 });
    expect(moves[2]).toEqual({ kind: 'feed', x: 0, y: 0, z: 0, feed: 100 });
    expect(moves[3]).toEqual({ kind: 'feed', x: 0, y: 0, z: -0.5, feed: 100 });
    // 4 sides at -0.5, plunge, 4 sides at -1
    expect(moves.filter((m) => m.kind === 'feed' && m.feed === 300)).toHaveLength(8);
    expect(moves.at(-1)).toEqual({ kind: 'rapid', x: 0, y: 0, z: 5 });
  });

  it('ramps in at 3° and never plunges straight down', () => {
    const moves = cut([square(0, 0, 40)], 'ramp');
    const verticalDrops = moves.filter(
      (m, i) =>
        i > 0 &&
        m.kind === 'feed' &&
        m.z < moves[i - 1]!.z &&
        m.x === moves[i - 1]!.x &&
        m.y === moves[i - 1]!.y,
    );
    // Only the feed from the approach height down to the surface.
    expect(verticalDrops.map((m) => m.z)).toEqual([0]);
    for (let i = 1; i < moves.length; i++) {
      const [a, b] = [moves[i - 1]!, moves[i]!];
      const run = Math.hypot(b.x - a.x, b.y - a.y);
      if (b.kind === 'feed' && run > 0 && b.z < a.z) {
        expect((a.z - b.z) / run).toBeLessThanOrEqual(Math.tan((3 * Math.PI) / 180) + 1e-9);
      }
    }
    expect(Math.min(...moves.map((m) => m.z))).toBe(-1);
  });

  it('runs open paths back and forth between passes', () => {
    const moves = cut([line], 'ramp');
    const cutEnds = moves.filter((m) => m.kind === 'feed' && m.feed === 300).map((m) => m.x);
    expect(cutEnds).toEqual([10, 0]);
  });
});

describe('orderPaths', () => {
  it('visits the nearest path next and starts loops at the nearest corner', () => {
    const far = square(100, 0);
    const near = square(20, 0);
    const { paths } = orderPaths([far, near], { x: 31, y: 11 });
    expect(paths[0]!.points[0]).toEqual({ x: 30, y: 10 });
    expect(paths[1]!.points[0]!.x).toBe(100);
  });

  it('reverses open paths when their end is closer', () => {
    const line: Path = {
      closed: false,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    };
    expect(orderPaths([line], { x: 11, y: 0 }).paths[0]!.points[0]).toEqual({ x: 10, y: 0 });
  });
});

describe('generateJob', () => {
  it('produces one program per bit in machine coordinates', () => {
    const { programs, diagnostics } = generateJob(makeJob(), DEFAULT_MACHINE_CONFIG);
    expect(diagnostics).toEqual([]);
    expect(programs).toHaveLength(1);
    const moves = programs[0]!.sections[0]!.moves;
    // Canvas square at (10..20, 10..20) on a 50 mm tall stock, origin bottom-left → machine Y 30..40
    const xs = moves.map((m) => m.x);
    const ys = moves.map((m) => m.y);
    expect(Math.min(...xs)).toBe(10);
    expect(Math.max(...xs)).toBe(20);
    expect(Math.min(...ys)).toBe(30);
    expect(Math.max(...ys)).toBe(40);
  });

  it('groups objects that share a bit', () => {
    const job = makeJob([
      makeObject(),
      makeObject({
        id: 'b',
        operation: profileOp({ side: 'on', bitId: 'vbit-90', depth: 1 }),
      }),
      makeObject({ id: 'c' }),
    ]);
    const { programs } = generateJob(job, DEFAULT_MACHINE_CONFIG);
    expect(programs.map((p) => [p.bit.id, p.sections.length])).toEqual([
      ['vbit-60', 2],
      ['vbit-90', 1],
    ]);
  });

  it('errors when there is nothing to cut', () => {
    const { diagnostics } = generateJob(
      makeJob([makeObject({ operation: null })]),
      DEFAULT_MACHINE_CONFIG,
    );
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'error' })]);
  });

  it('errors on bad depth or feeds and skips that object', () => {
    const job = makeJob([
      makeObject({
        operation: profileOp({ side: 'on', bitId: 'vbit-60', depth: 0 }),
      }),
      makeObject({
        id: 'b',
        operation: profileOp({ bitId: 'vbit-90', depth: 1 }),
      }),
    ]);
    const overrides = { 'plywood|vbit-90': { feed: Number.NaN } };
    const { programs, diagnostics } = generateJob(
      job,
      DEFAULT_MACHINE_CONFIG,
      undefined,
      overrides,
    );
    expect(programs).toEqual([]);
    expect(diagnostics.map((d) => d.message)).toEqual([
      'Logo: cut depth must be greater than 0.',
      'Logo: Feed must be greater than 0.',
    ]);
  });

  it('warns about off-stock cuts, spoilboard depth and clamped feeds', () => {
    const job = makeJob([
      makeObject({
        transform: { x: 95, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
        operation: profileOp({ depth: 7 }),
      }),
    ]);
    const overrides = { 'plywood|vbit-60': { feed: 5000 } };
    const messages = generateJob(job, DEFAULT_MACHINE_CONFIG, undefined, overrides).diagnostics.map(
      (d) => d.message,
    );
    expect(messages).toEqual([
      'Logo: Feed lowered from 5000 to the machine max of 1000 mm/min.',
      'Logo: cuts 1 mm into the spoilboard.',
      'Logo: goes past the edge of the stock.',
    ]);
  });

  it('engraves with a round-nose bit but refuses walls and floors', () => {
    const job = makeJob([
      makeObject({ id: 'a', operation: profileOp({ bitId: 'round-3.175', depth: 1 }) }),
      makeObject({ id: 'b', operation: profileOp({ bitId: 'round-3.175', side: 'outside' }) }),
    ]);
    const { programs, diagnostics } = generateJob(job, DEFAULT_MACHINE_CONFIG);
    expect(programs.map((p) => p.bit.id)).toEqual(['round-3.175']);
    expect(programs[0]!.sections).toHaveLength(1);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        toolpathId: 'tp-b',
        message:
          'Logo: Round-nose bits only cut on the line and drill. Pick an end mill for this cut.',
      }),
    );
  });
});

describe('estimateProgram', () => {
  it('adds up feed time, rapid time and spindle dwell', () => {
    const job = makeJob([makeObject({ operation: profileOp({ depth: 1, entry: 'plunge' }) })]);
    const { programs } = generateJob(job, { ...DEFAULT_MACHINE_CONFIG, spindleDwell: 0 });
    const stats = estimateProgram(programs[0]!, { ...DEFAULT_MACHINE_CONFIG, spindleDwell: 0 });
    // 2 passes × 40 mm perimeter + 1.5 mm of plunges (0.5 → -0.5 → -1)
    expect(stats.cutLength).toBeCloseTo(81.5);
    expect(stats.maxDepth).toBe(1);
    expect(stats.seconds).toBeGreaterThan(0);
  });
});

describe('manual spindle', () => {
  it('skips RPM checks and spin-up time when the spindle is switched by hand', () => {
    const machine = { ...DEFAULT_MACHINE_CONFIG, manualSpindle: true };
    const job = makeJob([makeObject({ operation: profileOp({ depth: 1, entry: 'plunge' }) })]);
    // An RPM override past the machine's max would normally be lowered with a note.
    const overrides = { 'plywood|vbit-60': { rpm: 50000 } };
    const { programs, diagnostics } = generateJob(job, machine, undefined, overrides);
    expect(diagnostics).toEqual([]);
    const withDwell = estimateProgram(programs[0]!, { ...machine, manualSpindle: false });
    expect(estimateProgram(programs[0]!, machine).seconds).toBeCloseTo(
      withDwell.seconds - machine.spindleDwell,
    );
  });
});
