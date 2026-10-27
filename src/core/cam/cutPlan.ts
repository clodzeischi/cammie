import type { Bounds, Path, Vec2 } from '../geometry/path';
import type { Face } from '../job/job';
import type { Feeds } from '../materials/materials';
import type { Bit } from '../tools/bits';
import { cutPocket, type PocketRings } from './pocket';
import { cutLoops, type CutLoopsParams } from './toolpath/cutLoops';
import { cutDrill, type DrillParams } from './toolpath/drill';
import type { MoveWriter } from './toolpath/moveWriter';

/** How to cut one object, ready to turn into moves. Coordinates are machine space. */
export type CutPlan =
  | { kind: 'loops'; groups: CutLoopsParams[] }
  | {
      kind: 'pocket';
      rings: PocketRings;
      depths: number[];
      entry: CutLoopsParams['entry'];
      finish: CutLoopsParams | null;
    }
  | ({ kind: 'drill' } & DrillParams);

/** Where tabs are and where they could go, in canvas space, for the preview editor. */
export interface TabPreview {
  /** Loops a tab can be placed on (the finished contour). */
  loops: Path[];
  /** Current tab centres. */
  centres: Vec2[];
}

/** Everything needed to cut one object, before it's placed in a file. */
export interface ObjectCut {
  toolpathId: string;
  objectId: string;
  face: Face;
  label: string;
  bit: Bit;
  depth: number;
  feeds: Feeds;
  plan: CutPlan;
  /** What the cut touches, in canvas coordinates (includes the tool's width). */
  cutBounds: Bounds;
  tabs: TabPreview | null;
}

/** What a planner hands back: the plan plus what the checks and preview need. */
export interface PlanResult {
  plan: CutPlan;
  /** Every tool-centre path (machine space), for bounds checks. */
  allPaths: Path[];
  tabs: TabPreview | null;
  /** True when tabs will actually hold the part. */
  tabsHold: boolean;
}

export function executePlan(writer: MoveWriter, plan: CutPlan): void {
  if (plan.kind === 'loops') {
    plan.groups.forEach((group) => cutLoops(writer, group));
    return;
  }
  if (plan.kind === 'drill') {
    cutDrill(writer, plan);
    return;
  }
  cutPocket(writer, { rings: plan.rings, depths: plan.depths, entry: plan.entry });
  if (plan.finish) cutLoops(writer, plan.finish);
}
