import { makeJob, makeObject } from '../../cam/testFixtures';
import { generateJob } from '../../cam/generateJob';
import { DEFAULT_MACHINE_CONFIG, type MachineConfig } from '../../machine/machineConfig';
import type { PostContext } from '../PostProcessor';
import { comment } from './formatting';
import { grblPost } from './grblPost';
import { lintGcode } from './lintGcode';

const context = (machine: MachineConfig): PostContext => ({
  machine,
  fileName: 'logo_01_vbit-60.nc',
  materialName: 'Plywood (birch)',
  stock: { width: 100, height: 50, thickness: 6 },
  originLabel: 'bottom-left',
  fileIndex: 1,
  fileCount: 1,
  estimatedSeconds: 75,
  appVersion: 'v0.1.0',
});

function render(machine: MachineConfig = DEFAULT_MACHINE_CONFIG, job = makeJob()) {
  const { programs } = generateJob(job, machine);
  return grblPost.render(programs[0]!, context(machine));
}

describe('grblPost', () => {
  it('matches the golden file', () => {
    // A 10 mm square, 1 mm deep in two passes with a 60° V-bit.
    expect(render()).toMatchInlineSnapshot(`
      "(Cammie v0.1.0: logo_01_vbit-60.nc)
      (Bit: V-bit 60 deg, tip 0.2mm | Material: Plywood birch)
      (Stock: 100x50x6mm | Origin: bottom-left, Z0 = top of material)
      (Estimated time: 1m 15s)
      (Start with the bit at X0 Y0, touching the top of the material)
      G21 G90 G94 G17
      G0 Z5.000
      (On the line: Logo)
      M3 S1000
      G4 P3
      G0 X10.000 Y30.000
      G0 Z0.500
      G1 Z-0.500 F200
      G1 Y40.000 F330
      G1 X20.000
      G1 Y30.000
      G1 X10.000
      G1 Z-1.000 F200
      G1 Y40.000 F330
      G1 X20.000
      G1 Y30.000
      G1 X10.000
      G0 Z5.000
      M5
      G0 X0.000 Y0.000
      M2
      "
    `);
  });

  it('passes the G-code linter', () => {
    expect(lintGcode(render(), DEFAULT_MACHINE_CONFIG)).toEqual([]);
  });

  it('includes custom header/footer and honours the end position', () => {
    const machine: MachineConfig = {
      ...DEFAULT_MACHINE_CONFIG,
      customHeader: '(my header)\n\n',
      customFooter: '(my footer)',
      endPosition: { mode: 'park', x: 5, y: 170 },
    };
    const lines = render(machine).trimEnd().split('\n');
    expect(lines.indexOf('(my header)')).toBe(lines.indexOf('G21 G90 G94 G17') + 1);
    expect(lines.slice(-4)).toEqual(['(my footer)', 'M5', 'G0 X5.000 Y170.000', 'M2']);
  });

  it('stays put when asked', () => {
    const machine: MachineConfig = { ...DEFAULT_MACHINE_CONFIG, endPosition: { mode: 'stay' } };
    expect(render(machine).trimEnd().split('\n').slice(-2)).toEqual(['M5', 'M2']);
  });

  it('maps RPM onto the $30 range and changes speed between sections', () => {
    const machine = { ...DEFAULT_MACHINE_CONFIG, maxSValue: 255 };
    const job = makeJob([
      makeObject(),
      makeObject({
        id: 'b',
        operation: {
          type: 'profile',
          side: 'on',
          bitId: 'vbit-60',
          depth: 1,
          overrides: { rpm: 5000 },
        },
      }),
    ]);
    const text = render(machine, job);
    expect(text).toContain('M3 S255');
    expect(text).toMatch(/^S128$/m);
  });

  it('notes multi-file jobs in the header', () => {
    const { programs } = generateJob(makeJob(), DEFAULT_MACHINE_CONFIG);
    const text = grblPost.render(programs[0]!, {
      ...context(DEFAULT_MACHINE_CONFIG),
      fileCount: 2,
    });
    expect(text).toContain('(File 1 of 2: change the bit and re-zero Z before running)');
  });
});

describe('comment', () => {
  it('strips nested parens and non-ASCII', () => {
    expect(comment('Café (logo) 😀')).toBe('(Cafe logo)');
  });
});

describe('lintGcode', () => {
  it('catches forbidden words and unsafe moves', () => {
    const bad = ['G0 X10 Y10', 'G28', 'M6 T1', 'G0 Z-1', '(a (nested) comment)'].join('\n');
    const problems = lintGcode(bad, DEFAULT_MACHINE_CONFIG);
    expect(problems).toHaveLength(6);
  });
});
