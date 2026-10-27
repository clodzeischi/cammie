import { boundsOfPaths, distance, type Path, type Vec2 } from '../geometry/path';
import type { DrillOperation } from '../job/job';
import type { Feeds } from '../materials/materials';
import type { Bit } from '../tools/bits';
import type { PlanResult } from './cutPlan';
import type { Diagnostic } from './program';
import { passDepths } from './toolpath/passes';

type Report = (severity: Diagnostic['severity'], message: string) => void;

/** Shapes this much wider than the bit get a note that drilling won't cut them to size. */
const SIZE_SLACK = 0.5;
/** Centres closer than this are one hole (e.g. a ring's outer and inner outline). */
const SAME_HOLE = 0.01;

/** The centre of each closed path's bounding box, without duplicates. */
export function holeCentres(paths: readonly Path[]): Vec2[] {
  const centres: Vec2[] = [];
  for (const path of paths) {
    const b = boundsOfPaths([path]);
    const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    if (!centres.some((other) => distance(other, c) < SAME_HOLE)) centres.push(c);
  }
  return centres;
}

/** Plans a drill cut: one bit-sized hole at the centre of each closed path (machine space). */
export function planDrill(
  operation: DrillOperation,
  bit: Bit,
  feeds: Feeds,
  paths: Path[],
  report: Report,
): PlanResult {
  const points = holeCentres(paths);
  const oversized = paths.some((path) => {
    const b = boundsOfPaths([path]);
    return Math.min(b.maxX - b.minX, b.maxY - b.minY) > bit.diameter + SIZE_SLACK;
  });
  if (oversized) {
    report(
      'warning',
      `drills one ${bit.diameter} mm hole at the centre of each shape. To cut a hole the size of the shape, use Profile inside.`,
    );
  }
  return {
    plan: { kind: 'drill', points, depths: passDepths(operation.depth, feeds.depthPerPass) },
    allPaths: points.map((p) => ({ closed: false, points: [p] })),
    tabs: null,
    tabsHold: false,
  };
}
