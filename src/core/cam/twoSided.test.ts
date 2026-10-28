import { buildExportFiles } from '../../app/exportFiles';
import { boundsOfPoints, signedArea } from '../geometry/path';
import { cutFrame, flipPoint } from '../job/faces';
import type { Job, Toolpath } from '../job/job';
import {
  PIN_DEPTH_INTO_SPOILBOARD,
  PIN_FIT_ALLOWANCE,
  pinCentres,
  pinLength,
  registrationCut,
  registrationHoles,
} from '../job/registration';
import { fitsEasyMode, insertToolpath, moveGroup, toolpathGroups } from '../job/toolpaths';
import { DEFAULT_MACHINE_CONFIG } from '../machine/machineConfig';
import { grblPost } from '../post/grbl/grblPost';
import { lintGcode } from '../post/grbl/lintGcode';
import { generateJob } from './generateJob';
import type { BitProgram } from './program';
import { makeJob, makeObject, pocketOp, profileOp } from './testFixtures';

const machine = { ...DEFAULT_MACHINE_CONFIG, spindleDwell: 0 };
const bottom = (job: Job, ids: string[] = job.toolpaths.map((t) => t.id)): Job => ({
  ...job,
  toolpaths: job.toolpaths.map((t) => (ids.includes(t.id) ? { ...t, face: 'bottom' } : t)),
});
const cutBounds = (program: BitProgram) =>
  boundsOfPoints(program.sections.flatMap((s) => s.moves.filter((m) => m.z < 0)));

describe('bottom cuts', () => {
  // Stock 100 × 50, object at canvas x 10..20, y 10..20, origin bottom-left.
  const job = makeJob([makeObject({ operation: profileOp({ side: 'outside', bitId: 'flat-2' }) })]);

  it('are mirrored across the flip line, because the stock is upside down', () => {
    const top = cutBounds(generateJob(job, machine).programs[0]!);
    const flipped = generateJob(bottom(job), machine).programs[0]!;
    expect(flipped.face).toBe('bottom');
    const b = cutBounds(flipped);
    // Left-right: x → 100 − x; Y is unchanged.
    expect(b.minX).toBeCloseTo(100 - top.maxX);
    expect(b.maxX).toBeCloseTo(100 - top.minX);
    expect(b.minY).toBeCloseTo(top.minY);

    const tb = cutBounds(generateJob({ ...bottom(job), flip: 'top-bottom' }, machine).programs[0]!);
    expect(tb.minX).toBeCloseTo(top.minX);
    expect(tb.minY).toBeCloseTo(50 - top.maxY);
  });

  it('still climb-cut after mirroring', () => {
    const loopArea = (j: Job) => {
      const moves = generateJob(j, machine).programs[0]!.sections[0]!.moves.filter(
        (m) => m.kind === 'feed' && m.z < 0,
      );
      return signedArea(moves);
    };
    expect(Math.sign(loopArea(bottom(job)))).toBe(Math.sign(loopArea(job)));
  });

  it('show their tabs on the design, where the user clicks to edit them', () => {
    const through = makeJob([
      makeObject({ operation: profileOp({ side: 'outside', bitId: 'flat-2', depth: 6.2 }) }),
    ]);
    const tabs = (j: Job) => generateJob(j, machine).tabs[0]!;
    // Automatic tabs sit on the object's outline on the design (x 9..21), not mirrored to x 79..91.
    const auto = tabs(bottom(through)).centres;
    expect(auto.length).toBeGreaterThan(0);
    auto.forEach((c) => expect(c.x).toBeGreaterThanOrEqual(9 - 1e-6));
    auto.forEach((c) => expect(c.x).toBeLessThanOrEqual(21 + 1e-6));

    // Hand-placed tabs (object space) come back exactly where they were put.
    const op = through.toolpaths[0]!.operation;
    const manual = {
      ...through,
      toolpaths: [
        {
          ...through.toolpaths[0]!,
          operation: {
            ...op,
            tabs: { ...(op.type === 'profile' ? op.tabs : null!), manual: [{ x: -1, y: 5 }] },
          },
        },
      ],
    };
    expect(tabs(bottom(manual)).centres[0]).toEqual({ x: 9, y: 15 });
  });

  it('run in their own files, after every top file', () => {
    const two = makeJob([
      makeObject({ id: 'a', operation: pocketOp() }),
      makeObject({ id: 'b', operation: pocketOp() }),
    ]);
    const { programs } = generateJob(bottom(two, ['tp-a']), machine);
    expect(programs.map((p) => p.face)).toEqual(['top', 'bottom']);
    expect(programs[0]!.sections[0]!.label).toBe('Pocket: Logo');
  });
});

describe('two-sided toolpath list', () => {
  const tp = (id: string, bitId: string, face?: 'bottom'): Toolpath => ({
    id,
    objectId: id,
    operation: profileOp({ bitId }),
    ...(face && { face }),
  });

  it('inserts bottom cuts after the top ones and never moves files across the flip', () => {
    const list = [tp('b1', 'vbit-60', 'bottom'), tp('t1', 'vbit-60'), tp('t2', 'flat-2')].reduce(
      insertToolpath,
      [],
    );
    expect(list.map((t) => t.id)).toEqual(['t1', 't2', 'b1']);
    const groups = toolpathGroups(list);
    expect(groups.map((g) => `${g.face}:${g.bitId}`)).toEqual([
      'top:vbit-60',
      'top:flat-2',
      'bottom:vbit-60',
    ]);
    expect(moveGroup(list, 'top', 'flat-2', 1).map((t) => t.id)).toEqual(['t1', 't2', 'b1']);
    expect(moveGroup(list, 'top', 'flat-2', -1).map((t) => t.id)).toEqual(['t2', 't1', 'b1']);
  });

  it('makes a job Pro only', () => {
    expect(fitsEasyMode({ toolpaths: [tp('a', 'vbit-60', 'bottom')] })).toBe(false);
  });
});

describe('registration holes', () => {
  const stock = { width: 100, height: 50, thickness: 6 };
  let n = 0;
  const holes = registrationHoles(stock, 'left-right', 6, () => `pin-${++n}`);

  it('sit on the flip line, so each lands on itself when the stock turns over', () => {
    expect(pinCentres(stock, 'left-right', 6)).toEqual([
      { x: 50, y: 8 },
      { x: 50, y: 42 },
    ]);
    for (const c of pinCentres(stock, 'top-bottom', 6)) {
      expect(flipPoint(c, stock, 'top-bottom')).toEqual(c);
    }
    expect(holes.map((h) => h.role)).toEqual(['registration', 'registration']);
    expect(holes[0]!.transform).toMatchObject({ x: 46.95 });
    expect(holes[0]!.transform.y).toBeCloseTo(5);
    // A little wider than the pin, so it slides in by hand.
    const b = boundsOfPoints(holes[0]!.paths[0]!.points);
    expect(b.maxX - b.minX).toBeCloseTo(6 + PIN_FIT_ALLOWANCE, 1);
  });

  it('suggest a pin length that stops just below the stock top', () => {
    expect(pinLength(stock)).toBe(PIN_DEPTH_INTO_SPOILBOARD + 5);
  });

  const withPins = (pins = holes): Job => {
    // A pocket on the bottom: its re-entries into the cleared floor must not rapid below Z0.
    const base = bottom(makeJob([makeObject({ operation: pocketOp({ depth: 2 }) })]));
    return {
      ...base,
      objects: [...base.objects, ...pins],
      toolpaths: pins.reduce(
        (list, pin) =>
          insertToolpath(list, {
            id: `cut-${pin.id}`,
            objectId: pin.id,
            operation: registrationCut(stock, 'flat-3.175'),
          }),
        base.toolpaths,
      ),
    };
  };

  it('are asked for when anything is cut on the bottom, and checked against the flip line', () => {
    const messages = (j: Job) => generateJob(j, machine).diagnostics.map((d) => d.message);
    expect(messages(bottom(makeJob([makeObject({ operation: pocketOp() })])))).toEqual([
      expect.stringMatching(/^Some cuts are on the bottom\. Add registration holes/),
    ]);
    // Through into the spoilboard on purpose: no spoilboard or tab warnings.
    expect(messages(withPins())).toEqual([]);
    const moved = { ...holes[0]!, transform: { ...holes[0]!.transform, x: 60 } };
    expect(messages(withPins([moved, holes[1]!]))).toEqual([
      expect.stringMatching(/^Registration hole 1: isn't on the flip line/),
    ]);
  });

  it('are cut first, and the first bottom file says to turn the stock over', () => {
    const job = withPins();
    const { programs } = generateJob(job, machine);
    const files = buildExportFiles(programs, job, machine, 'Box', grblPost);
    expect(files.map((f) => f.name)).toEqual([
      'box_01_flat-3.175.nc',
      'box_02_bottom_flat-3.175.nc',
    ]);
    expect(programs[0]!.sections.map((s) => s.label)).toEqual([
      'Inside: Registration hole 1',
      'Inside: Registration hole 2',
    ]);
    expect(files[1]!.text).toContain(
      '(File 2 of 2: bottom side. Turn the stock over left to right onto the registration pins and re-zero Z only: keep X/Y zero where it is, the pins line the stock up with it)',
    );
    files.forEach((f) => expect(lintGcode(f.text, machine)).toEqual([]));
  });

  it('use the same frame for the design and the machine on the top', () => {
    const frame = cutFrame(makeJob(), 'top');
    expect(frame.toCanvas(frame.toMachine({ x: 12, y: 34 }))).toEqual({ x: 12, y: 34 });
  });
});

describe('top cut-outs in a two-sided job', () => {
  const cutOut = (tabs: boolean) =>
    makeObject({
      operation: profileOp({
        side: 'outside',
        bitId: 'flat-3.175',
        depth: 6,
        tabs: { ...profileOp().tabs, enabled: tabs },
      }),
    });
  const engraveBottom = makeObject({ id: 'b', operation: profileOp() });
  const messages = (job: Job) => generateJob(job, machine).diagnostics.map((d) => d.message);

  it('warn when the part has no tabs, because it falls out before the flip', () => {
    const job = bottom(makeJob([cutOut(false), engraveBottom]), ['tp-b']);
    expect(messages(job)).toContainEqual(
      expect.stringMatching(/comes loose before the stock is turned over/),
    );
  });

  it('are fine with tabs', () => {
    const job = bottom(makeJob([cutOut(true), engraveBottom]), ['tp-b']);
    expect(messages(job).some((m) => m.includes('comes loose'))).toBe(false);
  });
});
