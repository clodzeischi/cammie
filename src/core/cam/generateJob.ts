import {
  boundsOfPaths,
  isEmptyBounds,
  unionBounds,
  EMPTY_BOUNDS,
  type Bounds,
} from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import { anchorPoint, canvasToMachine, type DesignObject, type Job } from '../job/job';
import type { MachineConfig } from '../machine/machineConfig';
import { findMaterial } from '../materials/materials';
import { BUILT_IN_BITS, findBit, type Bit } from '../tools/bits';
import { engravePaths } from './engrave';
import { orderPaths } from './ordering';
import type { BitProgram, Diagnostic, GeneratedJob, ProgramSection } from './program';
import { feedLabel, resolveFeeds } from './resolveFeeds';

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
): GeneratedJob {
  const diagnostics: Diagnostic[] = [];
  const programs = new Map<string, BitProgram>();
  const origin = anchorPoint(job.stock, job.origin);
  const material = findMaterial(job.materialId);
  let cutBounds: Bounds = EMPTY_BOUNDS;
  let maxDepth = 0;

  if (!material) diagnostics.push({ severity: 'error', message: 'Pick a material.' });

  for (const object of job.objects) {
    const { operation } = object;
    if (!operation || !material) continue;
    const problem = (severity: Diagnostic['severity'], message: string) =>
      diagnostics.push({ severity, message: `${object.name}: ${message}`, objectId: object.id });

    const bit = findBit(operation.bitId, bits);
    if (!bit) {
      problem('error', 'its bit no longer exists. Pick another one.');
      continue;
    }
    if (!Number.isFinite(operation.depth) || operation.depth <= 0) {
      problem('error', 'cut depth must be greater than 0.');
      continue;
    }
    const { feeds, clamped, invalid } = resolveFeeds(material, bit, operation.overrides, machine);
    if (invalid.length > 0) {
      problem('error', `${invalid.map(feedLabel).join(', ')} must be greater than 0.`);
      continue;
    }
    clamped.forEach((note) => problem('warning', note));

    const canvasPaths = transformPaths(object.paths, object.transform);
    if (canvasPaths.every((p) => p.points.length === 0)) {
      problem('warning', 'has no outlines, so nothing will be cut.');
      continue;
    }
    const bounds = boundsOfPaths(canvasPaths);
    checkOnStock(bounds, job, problem);
    cutBounds = unionBounds(cutBounds, bounds);
    maxDepth = Math.max(maxDepth, operation.depth);

    if (operation.depth > job.stock.thickness + EPSILON) {
      problem('warning', `cuts ${fmt(operation.depth - job.stock.thickness)} into the spoilboard.`);
    }

    const machinePaths = canvasPaths.map((path) => ({
      closed: path.closed,
      points: path.points.map((p) => canvasToMachine(p, origin)),
    }));
    const program = programs.get(bit.id) ?? { bit, sections: [] };
    programs.set(bit.id, program);
    program.sections.push(
      engraveSection(object, machinePaths, feeds, operation.depth, machine, program),
    );
  }

  if (programs.size === 0 && !diagnostics.some((d) => d.severity === 'error')) {
    diagnostics.push({
      severity: 'error',
      message: 'Nothing to cut yet. Import an image and give it an operation.',
    });
  }
  checkMachineFits(cutBounds, maxDepth, machine, diagnostics);

  return { programs: [...programs.values()], diagnostics };
}

function engraveSection(
  object: DesignObject,
  machinePaths: Parameters<typeof orderPaths>[0],
  feeds: ReturnType<typeof resolveFeeds>['feeds'],
  depth: number,
  machine: MachineConfig,
  program: BitProgram,
): ProgramSection {
  // Continue from where the previous section on this bit left off.
  const previous = program.sections.at(-1)?.moves.at(-1);
  const start = previous ? { x: previous.x, y: previous.y } : { x: 0, y: 0 };
  const { paths } = orderPaths(machinePaths, start);
  return {
    label: `Engrave: ${object.name}`,
    rpm: feeds.rpm,
    moves: engravePaths(paths, { depth, feeds, safeZ: machine.safeZ }),
  };
}

function checkOnStock(
  b: Bounds,
  job: Job,
  problem: (severity: Diagnostic['severity'], message: string) => void,
) {
  const { width, height } = job.stock;
  if (
    b.minX < -EPSILON ||
    b.minY < -EPSILON ||
    b.maxX > width + EPSILON ||
    b.maxY > height + EPSILON
  ) {
    problem('warning', 'goes past the edge of the stock.');
  }
}

function checkMachineFits(b: Bounds, depth: number, machine: MachineConfig, out: Diagnostic[]) {
  if (isEmptyBounds(b)) return;
  const { x, y, z } = machine.workArea;
  if (b.maxX - b.minX > x || b.maxY - b.minY > y) {
    out.push({
      severity: 'warning',
      message: `The cuts span ${fmt(b.maxX - b.minX)} × ${fmt(b.maxY - b.minY)}, more than the machine's ${x} × ${y} mm work area.`,
    });
  }
  if (depth + machine.safeZ > z) {
    out.push({
      severity: 'warning',
      message: `Depth plus safe Z is more than the machine's ${z} mm Z travel.`,
    });
  }
}
