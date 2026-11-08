import { chamferOp, makeJob, makeObject, pocketOp, vcarveOp } from '../core/cam/testFixtures';
import {
  createPolylineObject,
  createShapeObject,
  DEFAULT_COG,
  DEFAULT_POLYGON,
  DEFAULT_RECT,
  DEFAULT_STAR,
} from '../core/shapes/shapeObjects';
import type { Bit } from '../core/tools/bits';
import { parseProject, serializeProject, type Project } from './projectFile';

const myBit: Bit = { id: 'custom-1', name: 'My 6 mm', type: 'flat', diameter: 6, flutes: 2 };
const unused: Bit = { id: 'custom-2', name: 'Spare', type: 'round', diameter: 4, flutes: 2 };

function sampleProject(): Project {
  const stock = { width: 100, height: 50, thickness: 6 };
  const rect = createShapeObject('r', DEFAULT_RECT, stock);
  const drawn = [
    createShapeObject('poly', DEFAULT_POLYGON, stock),
    createShapeObject('star', DEFAULT_STAR, stock),
    createShapeObject('cog', DEFAULT_COG, stock),
    createPolylineObject(
      'line',
      [
        { x: 1, y: 2 },
        { x: 30, y: 5 },
        { x: 10, y: 20 },
      ],
      true,
      0.5,
    ),
  ];
  const job = makeJob([
    makeObject({ id: 'a', groupId: 'g', operation: pocketOp({ bitId: 'custom-1' }) }),
    makeObject({ id: 'b', operation: chamferOp({ side: 'inside' }) }),
    makeObject({ id: 'c', operation: vcarveOp({ warnDepth: 2.5 }) }),
    makeObject({ id: 'd', operation: vcarveOp() }),
    { ...rect, operation: null },
    ...drawn.map((o) => ({ ...o, operation: null })),
  ]);
  return {
    jobName: 'Box lid',
    job,
    bits: [myBit, unused],
  };
}

const parsed = (text: string) => {
  const result = parseProject(text);
  if (!result.ok) throw new Error(result.error);
  return result.project;
};

describe('project files', () => {
  it('round-trips a design, keeping only the custom bits it uses', () => {
    const project = sampleProject();
    const back = parsed(serializeProject(project));
    expect(back.job).toEqual(project.job);
    expect(back.jobName).toBe('Box lid');
    expect(back.bits).toEqual([myBit]);
  });

  it('fills settings older files lack and drops cuts whose object is gone', () => {
    const file = JSON.parse(serializeProject(sampleProject()));
    delete file.job.toolpaths[0].operation.direction;
    file.job.toolpaths.push({ id: 'x', objectId: 'gone', operation: pocketOp() });
    const back = parsed(JSON.stringify(file));
    expect(back.job.toolpaths[0]!.operation.direction).toBe('climb');
    expect(back.job.toolpaths.map((t) => t.id)).not.toContain('x');
  });

  it('leaves out bottom-side cuts from older two-sided projects, and says so', () => {
    const file = JSON.parse(serializeProject(sampleProject()));
    file.job.flip = 'top-bottom';
    file.job.toolpaths[0].face = 'bottom';
    file.job.objects[1].role = 'registration';
    const result = parseProject(JSON.stringify(file));
    if (!result.ok) throw new Error(result.error);
    expect(result.project.job.toolpaths).toHaveLength(sampleProject().job.toolpaths.length - 1);
    expect(result.project.job).not.toHaveProperty('flip');
    expect(result.project.job.objects[1]).not.toHaveProperty('role');
    expect(result.notes).toEqual([
      "One cut was set to run on the bottom of the stock. Cammie no longer cuts two-sided jobs, so it's been left out.",
    ]);
    expect(parseProject(serializeProject(sampleProject()))).toMatchObject({ notes: [] });
  });

  it('refuses other files, newer versions and damaged designs with a reason', () => {
    const error = (text: string) => {
      const r = parseProject(text);
      return r.ok ? null : r.error;
    };
    expect(error('not json')).toMatch(/isn't a Cammie project/);
    expect(error('{"format":"something-else"}')).toMatch(/isn't a Cammie project/);
    expect(error('{"format":"cammie-project","version":99}')).toMatch(/newer version/);

    const file = JSON.parse(serializeProject(sampleProject()));
    file.job.objects[0].paths[0].points[1] = { x: 'one', y: 2 };
    expect(error(JSON.stringify(file))).toMatch(/damaged \(a point couldn't be read\)/);
  });
});
