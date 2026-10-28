import { generateJob } from '../../core/cam/generateJob';
import { makeJob } from '../../core/cam/testFixtures';
import { cutFrame } from '../../core/job/faces';
import { DEFAULT_MACHINE_CONFIG } from '../../core/machine/machineConfig';
import { buildPreview, completedRuns } from './toolpathRuns';

const job = makeJob();
const frame = cutFrame(job, 'top');
const program = generateJob(job, DEFAULT_MACHINE_CONFIG).programs[0]!;

describe('buildPreview', () => {
  it('splits moves into rapid and feed runs in canvas coordinates', () => {
    const preview = buildPreview(program, frame);
    expect(preview.runs.map((r) => r.kind)).toEqual(['rapid', 'feed', 'rapid']);
    expect(preview.moveCount).toBe(program.sections[0]!.moves.length);
    // The feed run follows the square at canvas (10..20, 10..20)
    const feed = preview.runs[1]!;
    const xs = feed.points.filter((_, i) => i % 2 === 0);
    const ys = feed.points.filter((_, i) => i % 2 === 1);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      10, 20, 10, 20,
    ]);
    expect(preview.positions[0]).toEqual({ x: 0, y: 50 }); // machine X0 Y0 = stock bottom-left
  });

  it('cuts runs short for the scrubber', () => {
    const preview = buildPreview(program, frame);
    expect(completedRuns(preview, 0)).toEqual([]);
    const partial = completedRuns(preview, 3);
    expect(partial.map((r) => r.moveCount)).toEqual([2, 1]);
    expect(partial[1]!.points).toHaveLength(4);
    expect(completedRuns(preview, preview.moveCount)).toEqual(preview.runs);
  });

  it('handles programs with hundreds of thousands of moves', () => {
    // Regression: Math.max(...moves) overflowed the call stack on big pockets.
    const moves = Array.from({ length: 500_000 }, (_, i) => ({
      kind: 'feed' as const,
      x: i % 100,
      y: 0,
      z: -1,
      feed: 500,
    }));
    const big = { ...program, sections: [{ label: 'Big', rpm: 10000, moves }] };
    expect(buildPreview(big, frame).moveCount).toBe(500_000);
  });
});
