import { generateJob } from '../core/cam/generateJob';
import { makeJob, makeObject } from '../core/cam/testFixtures';
import { DEFAULT_MACHINE_CONFIG } from '../core/machine/machineConfig';
import { grblPost } from '../core/post/grbl/grblPost';
import { lintGcode } from '../core/post/grbl/lintGcode';
import { buildExportFiles, slugify } from './exportFiles';

describe('slugify', () => {
  it('makes safe file names', () => {
    expect(slugify('My Owl Logo!')).toBe('my-owl-logo');
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('  ')).toBe('cammie-job');
  });
});

describe('buildExportFiles', () => {
  it('names one numbered file per bit and every file passes the linter', () => {
    const job = makeJob([
      makeObject(),
      makeObject({
        id: 'b',
        operation: { type: 'engrave', bitId: 'vbit-90', depth: 0.3, overrides: {} },
      }),
    ]);
    const { programs } = generateJob(job, DEFAULT_MACHINE_CONFIG);
    const files = buildExportFiles(programs, job, DEFAULT_MACHINE_CONFIG, 'Owl', grblPost);

    expect(files.map((f) => f.name)).toEqual(['owl_01_vbit-60.nc', 'owl_02_vbit-90.nc']);
    expect(files[1]!.text).toContain('(File 2 of 2: change the bit and re-zero Z before running)');
    files.forEach((f) => expect(lintGcode(f.text, DEFAULT_MACHINE_CONFIG)).toEqual([]));
  });
});
