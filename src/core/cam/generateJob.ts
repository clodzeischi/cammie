import { isEmptyBounds, unionBounds, EMPTY_BOUNDS, type Bounds, type Vec2 } from '../geometry/path';
import { cutFrame, faceOf } from '../job/faces';
import type { Job } from '../job/job';
import { groupIntoFiles } from '../job/toolpaths';
import type { MachineConfig } from '../machine/machineConfig';
import { findMaterial } from '../materials/materials';
import { BUILT_IN_BITS, type Bit } from '../tools/bits';
import type { FeedOverrides } from '../materials/feedOverrides';
import { executePlan, type ObjectCut } from './cutPlan';
import { planObjectCut } from './objectCut';
import { MoveWriter } from './toolpath/moveWriter';
import type { BitProgram, Diagnostic, GeneratedJob, ProgramSection } from './program';
import { checkTwoSided } from './twoSidedChecks';

/** Slack for floating-point noise when checking that cuts stay on the stock. */
const EPSILON = 0.01;

const fmt = (mm: number) => `${Math.round(mm * 100) / 100} mm`;

/**
 * Turns the whole design into one toolpath program per bit, plus everything
 * the user should know before cutting. Pure: same job in, same output.
 */
export function generateJob(
  job: Job,
  machine: MachineConfig,
  bits: readonly Bit[] = BUILT_IN_BITS,
  feedOverrides: FeedOverrides = {},
): GeneratedJob {
  const diagnostics: Diagnostic[] = [];
  const material = findMaterial(job.materialId);
  if (!material) {
    return {
      programs: [],
      diagnostics: [{ severity: 'error', message: 'Pick a material.' }],
      tabs: [],
    };
  }

  const frames = { top: cutFrame(job, 'top'), bottom: cutFrame(job, 'bottom') };
  const objects = new Map(job.objects.map((o) => [o.id, o]));
  const cuts: ObjectCut[] = [];
  for (const toolpath of job.toolpaths) {
    const object = objects.get(toolpath.objectId);
    if (!object) continue;
    const report = (severity: Diagnostic['severity'], message: string) =>
      diagnostics.push({
        severity,
        message: `${object.name}: ${message}`,
        objectId: object.id,
        toolpathId: toolpath.id,
      });
    const cut = planObjectCut(
      toolpath.id,
      object,
      toolpath.operation,
      { job, machine, material, bits, feedOverrides, frame: frames[faceOf(toolpath)] },
      report,
    );
    if (!cut) continue;
    if (!onStock(cut.cutBounds, job)) report('warning', 'goes past the edge of the stock.');
    cuts.push(cut);
  }

  if (cuts.length === 0 && !diagnostics.some((d) => d.severity === 'error')) {
    diagnostics.push({
      severity: 'error',
      message: 'Nothing to cut yet. Add a shape and give it a cut.',
    });
  }
  checkMachineFits(cuts, machine, diagnostics);
  checkTwoSided(job, diagnostics);
  const tabs = cuts.flatMap((cut) =>
    cut.tabs ? [{ toolpathId: cut.toolpathId, objectId: cut.objectId, ...cut.tabs }] : [],
  );
  return { programs: buildPrograms(cuts, machine), diagnostics, tabs };
}

/**
 * One program per face and bit, in the order the toolpath list gives (see
 * groupIntoFiles): top files first, cuts in list order within a file. New
 * toolpaths are placed so this is the safe order (see insertToolpath) unless
 * the user moves them.
 */
function buildPrograms(cuts: ObjectCut[], machine: MachineConfig): BitProgram[] {
  const groups = groupIntoFiles(cuts, (cut) => ({ face: cut.face, bitId: cut.bit.id }));

  return groups.map(({ face, items: group }) => {
    let position: Vec2 = { x: 0, y: 0 };
    const sections: ProgramSection[] = group.map((cut) => {
      const writer = new MoveWriter(machine.safeZ, cut.feeds, position);
      executePlan(writer, cut.plan);
      position = writer.position;
      return { label: cut.label, rpm: cut.feeds.rpm, moves: writer.moves };
    });
    return { bit: group[0]!.bit, face, sections };
  });
}

function onStock(b: Bounds, job: Job): boolean {
  const { width, height } = job.stock;
  return (
    b.minX >= -EPSILON &&
    b.minY >= -EPSILON &&
    b.maxX <= width + EPSILON &&
    b.maxY <= height + EPSILON
  );
}

function checkMachineFits(cuts: ObjectCut[], machine: MachineConfig, out: Diagnostic[]) {
  const b = cuts.reduce<Bounds>((acc, cut) => unionBounds(acc, cut.cutBounds), EMPTY_BOUNDS);
  if (isEmptyBounds(b)) return;
  const { x, y, z } = machine.workArea;
  if (b.maxX - b.minX > x || b.maxY - b.minY > y) {
    out.push({
      severity: 'warning',
      message: `The cuts span ${fmt(b.maxX - b.minX)} × ${fmt(b.maxY - b.minY)}, more than the machine's ${x} × ${y} mm work area.`,
    });
  }
  const depth = Math.max(...cuts.map((c) => c.depth));
  if (depth + machine.safeZ > z) {
    out.push({
      severity: 'warning',
      message: `Depth plus safe Z is more than the machine's ${z} mm Z travel.`,
    });
  }
}
