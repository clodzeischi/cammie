import { isEmptyBounds, unionBounds, EMPTY_BOUNDS, type Bounds, type Vec2 } from '../geometry/path';
import { anchorPoint, type Job } from '../job/job';
import type { MachineConfig } from '../machine/machineConfig';
import { findMaterial } from '../materials/materials';
import { BUILT_IN_BITS, type Bit } from '../tools/bits';
import type { FeedOverrides } from '../materials/feedOverrides';
import { executePlan, type ObjectCut } from './cutPlan';
import { planObjectCut } from './objectCut';
import { MoveWriter } from './toolpath/moveWriter';
import type { BitProgram, Diagnostic, GeneratedJob, ProgramSection } from './program';

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

  const origin = anchorPoint(job.stock, job.origin);
  const cuts: ObjectCut[] = [];
  for (const object of job.objects) {
    const report = (severity: Diagnostic['severity'], message: string) =>
      diagnostics.push({ severity, message: `${object.name}: ${message}`, objectId: object.id });
    const cut = planObjectCut(
      object,
      { job, machine, material, bits, feedOverrides, origin },
      report,
    );
    if (!cut) continue;
    if (!onStock(cut.cutBounds, job)) report('warning', 'goes past the edge of the stock.');
    cuts.push(cut);
  }

  if (cuts.length === 0 && !diagnostics.some((d) => d.severity === 'error')) {
    diagnostics.push({
      severity: 'error',
      message: 'Nothing to cut yet. Import a file and give it an operation.',
    });
  }
  checkMachineFits(cuts, machine, diagnostics);
  const tabs = cuts.flatMap((cut) => (cut.tabs ? [{ objectId: cut.objectId, ...cut.tabs }] : []));
  return { programs: buildPrograms(cuts, machine), diagnostics, tabs };
}

/**
 * One program per bit. Files are ordered by their earliest kind of cut (so
 * detail work comes before cutting parts free), and within a file the cuts run
 * by priority, keeping design order for ties.
 */
function buildPrograms(cuts: ObjectCut[], machine: MachineConfig): BitProgram[] {
  const byBit = new Map<string, ObjectCut[]>();
  for (const cut of cuts) byBit.set(cut.bit.id, [...(byBit.get(cut.bit.id) ?? []), cut]);

  const groups = [...byBit.values()]
    .map((group) => [...group].sort((a, b) => a.priority - b.priority))
    .sort((a, b) => a[0]!.priority - b[0]!.priority);

  return groups.map((group) => {
    let position: Vec2 = { x: 0, y: 0 };
    const sections: ProgramSection[] = group.map((cut) => {
      const writer = new MoveWriter(machine.safeZ, cut.feeds, position);
      executePlan(writer, cut.plan);
      position = writer.position;
      return { label: cut.label, rpm: cut.feeds.rpm, moves: writer.moves };
    });
    return { bit: group[0]!.bit, sections };
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
