import type { Path } from '../geometry/path';
import type { Toolpath } from '../job/job';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { generateJob } from './generateJob';
import type { Move } from './program';
import { drillOp, makeJob, makeObject, pocketOp, profileOp, square } from './testFixtures';

const machine = { ...DEFAULT_MACHINE_CONFIG, spindleDwell: 0 };
/** Feed moves into the stock (below its top). */
const cutting = (moves: Move[]) => moves.filter((m) => m.kind === 'feed' && m.z < -1e-9);
const highest = (moves: Move[]) => Math.max(...cutting(moves).map((m) => m.z));
const deepest = (moves: Move[]) => Math.min(...cutting(moves).map((m) => m.z));

const circle = (cx: number, cy: number, r: number): Path => ({
  closed: true,
  points: Array.from({ length: 64 }, (_, i) => ({
    x: cx + r * Math.cos((i / 64) * 2 * Math.PI),
    y: cy + r * Math.sin((i / 64) * 2 * Math.PI),
  })),
});

/** An M3 counterbore: Ø6 × 5 mm cut with a 3.175 mm end mill, 6 mm stock. */
const counterbore = makeObject({
  id: 'bore',
  name: 'Head',
  paths: [circle(10, 10, 3)],
  operation: profileOp({ side: 'inside', bitId: 'flat-3.175', depth: 5 }),
});

/** Moves of the cut on the object with this id. */
function sectionMoves(job: ReturnType<typeof makeJob>, objectName: string) {
  const { programs } = generateJob(job, machine);
  const section = programs
    .flatMap((p) => p.sections)
    .find((s) => s.label.endsWith(`: ${objectName}`));
  return section!.moves;
}

const reorder = (job: ReturnType<typeof makeJob>, ids: string[]) => ({
  ...job,
  toolpaths: ids.map((id) => job.toolpaths.find((t) => t.objectId === id)!) as Toolpath[],
});

describe('stacked cuts start on the floor earlier cuts left', () => {
  it('cuts a through hole inside its counterbore from the counterbore floor down', () => {
    const shank = makeObject({
      id: 'shank',
      name: 'Shank',
      paths: [circle(10, 10, 1.7)],
      operation: profileOp({ side: 'inside', bitId: 'flat-2', depth: 6.2 }),
    });
    const job = makeJob([counterbore, shank]);
    const moves = sectionMoves(job, 'Shank');
    expect(highest(moves)).toBeCloseTo(-5);
    expect(deepest(moves)).toBeCloseTo(-6.2);
    expect(generateJob(job, machine).diagnostics).not.toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/runs before/) }),
    );
  });

  it('drills the shank from the counterbore floor once it runs after it', () => {
    const shank = makeObject({
      id: 'shank',
      name: 'Shank',
      paths: [circle(10, 10, 1.6)],
      operation: drillOp({ bitId: 'flat-3.175', depth: 6.2 }),
    });
    // Drills are listed first by default; this job runs the counterbore first.
    const job = reorder(makeJob([counterbore, shank]), ['bore', 'shank']);
    const moves = sectionMoves(job, 'Shank');
    expect(highest(moves)).toBeCloseTo(-5);
    expect(deepest(moves)).toBeCloseTo(-6.2);
  });

  it('says to move a cut that runs before the one clearing its top', () => {
    const shank = makeObject({
      id: 'shank',
      name: 'Shank',
      paths: [circle(10, 10, 1.6)],
      operation: drillOp({ bitId: 'flat-3.175', depth: 6.2 }),
    });
    const job = makeJob([counterbore, shank]); // drill runs first
    expect(highest(sectionMoves(job, 'Shank'))).toBeGreaterThan(-1.1);
    expect(generateJob(job, machine).diagnostics).toContainEqual(
      expect.objectContaining({
        toolpathId: 'tp-shank',
        message: expect.stringMatching(/runs before "Inside: Head".*starts 5 mm down/),
      }),
    );
  });

  it('starts at the top when the cut only partly overlaps cleared material', () => {
    const shank = makeObject({
      id: 'shank',
      name: 'Shank',
      paths: [circle(12.5, 10, 1.7)], // pokes out of the Ø6 counterbore
      operation: profileOp({ side: 'inside', bitId: 'flat-2', depth: 6.2 }),
    });
    const moves = sectionMoves(makeJob([counterbore, shank]), 'Shank');
    expect(highest(moves)).toBeGreaterThan(-1.1);
  });

  it('starts a hole on a pocket floor, and skips a hole the pocket already cut deeper', () => {
    const pocket = makeObject({
      id: 'pocket',
      name: 'Tray',
      paths: [square(0, 0, 30)],
      operation: pocketOp({ depth: 3 }),
    });
    const hole = makeObject({
      id: 'hole',
      name: 'Hole',
      paths: [circle(15, 15, 3)],
      operation: profileOp({ side: 'inside', bitId: 'flat-2', depth: 6.2 }),
    });
    const shallow = makeObject({
      id: 'shallow',
      name: 'Shallow',
      paths: [circle(5, 25, 2)],
      operation: profileOp({ side: 'inside', bitId: 'flat-2', depth: 2 }),
    });
    const job = makeJob([pocket, hole, shallow]);
    expect(highest(sectionMoves(job, 'Hole'))).toBeCloseTo(-3);
    expect(cutting(sectionMoves(job, 'Shallow'))).toEqual([]);
  });

  it("doesn't count cuts made with V-bits as clearing", () => {
    const groove = makeObject({
      id: 'groove',
      name: 'Groove',
      paths: [circle(10, 10, 3)],
      operation: profileOp({ side: 'on', bitId: 'vbit-90', depth: 2 }),
    });
    const hole = makeObject({
      id: 'hole',
      name: 'Hole',
      paths: [circle(10, 10, 3)],
      operation: profileOp({ side: 'inside', bitId: 'flat-2', depth: 3 }),
    });
    const job = reorder(makeJob([groove, hole]), ['groove', 'hole']);
    expect(highest(sectionMoves(job, 'Hole'))).toBeGreaterThan(-1.1);
  });
});
