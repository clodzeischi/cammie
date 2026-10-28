import { chamferOp, makeJob, makeObject, pocketOp } from '../core/cam/testFixtures';
import { createShapeObject, DEFAULT_RECT } from '../core/shapes/shapeObjects';
import type { Bit } from '../core/tools/bits';
import { parseProject, serializeProject, type Project } from './projectFile';

const myBit: Bit = { id: 'custom-1', name: 'My 6 mm', type: 'flat', diameter: 6, flutes: 2 };
const unused: Bit = { id: 'custom-2', name: 'Spare', type: 'round', diameter: 4, flutes: 2 };

function sampleProject(): Project {
  const rect = createShapeObject('r', DEFAULT_RECT, { width: 100, height: 50, thickness: 6 });
  const job = makeJob([
    makeObject({ id: 'a', groupId: 'g', operation: pocketOp({ bitId: 'custom-1' }) }),
    makeObject({ id: 'b', role: 'registration', operation: chamferOp({ side: 'inside' }) }),
    { ...rect, operation: null },
  ]);
  return {
    jobName: 'Box lid',
    job: {
      ...job,
      flip: 'top-bottom',
      toolpaths: job.toolpaths.map((t) => (t.objectId === 'a' ? { ...t, face: 'bottom' } : t)),
    },
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
    delete file.job.flip;
    delete file.job.toolpaths[0].operation.direction;
    file.job.toolpaths.push({ id: 'x', objectId: 'gone', operation: pocketOp() });
    const back = parsed(JSON.stringify(file));
    expect(back.job.flip).toBe('left-right');
    expect(back.job.toolpaths[0]!.operation.direction).toBe('climb');
    expect(back.job.toolpaths.map((t) => t.id)).not.toContain('x');
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
