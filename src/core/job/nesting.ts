import { convexHull, rotatePoints, tightestTurn } from '../geometry/hull';
import { boundsOfPoints, type Bounds, type Vec2 } from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import type { DesignObject, Stock } from './job';
import { FreeSpace, type Rect } from './maxRects';

/**
 * Automatic arranging ("nesting", SPEC.md §6.4): packs shapes onto the stock
 * so the space left over is one large usable area. Each part is packed by
 * the box around its actual outline, turned to whichever angle fits best.
 */

export interface NestOptions {
  /** Gap kept between parts, and between parts and the stock's edges (mm). */
  spacing: number;
  /** Move parts without turning them. */
  keepRotation: boolean;
}

export interface NestResult {
  objects: DesignObject[];
  /** Parts (shapes, groups, or shapes with others inside them) that were placed. */
  placed: number;
  /** Parts that didn't fit and were left where they were. */
  leftOut: number;
}

/** Shapes that move as one: a group, or a shape and what lies inside it (text on a plaque). */
interface Part {
  ids: Set<string>;
  hull: Vec2[];
  /** Centre of the part's box, which it turns about. */
  pivot: Vec2;
  turns: Turn[];
}

/** One way to turn a part, with the size of its box that way. */
interface Turn {
  degrees: number;
  width: number;
  height: number;
}

interface Placement {
  part: Part;
  turn: Turn;
  spot: Vec2;
}

const outlinePoints = (o: DesignObject): Vec2[] =>
  transformPaths(o.paths, o.transform).flatMap((p) => p.points);

/** Is box `inner` entirely within box `outer`? */
const within = (inner: Bounds, outer: Bounds) =>
  inner.minX >= outer.minX &&
  inner.minY >= outer.minY &&
  inner.maxX <= outer.maxX &&
  inner.maxY <= outer.maxY;

/**
 * Joins shapes into parts (union-find): shapes sharing a group, and a shape
 * with any shape whose box lies inside its own. Shapes that merely overlap,
 * like copies pasted on top of each other, stay separate parts.
 */
function findParts(objects: readonly DesignObject[]): DesignObject[][] {
  const parent = objects.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  const join = (a: number, b: number) => (parent[root(a)] = root(b));
  const boxes = objects.map((o) => boundsOfPoints(outlinePoints(o)));
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const sameGroup = objects[i]!.groupId && objects[i]!.groupId === objects[j]!.groupId;
      const nested = within(boxes[i]!, boxes[j]!) || within(boxes[j]!, boxes[i]!);
      if (sameGroup || nested) join(i, j);
    }
  }
  const parts = new Map<number, DesignObject[]>();
  objects.forEach((o, i) => parts.set(root(i), [...(parts.get(root(i)) ?? []), o]));
  return [...parts.values()];
}

function makePart(members: readonly DesignObject[], keepRotation: boolean): Part {
  const hull = convexHull(members.flatMap(outlinePoints));
  const box = boundsOfPoints(hull);
  const pivot = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const tight = tightestTurn(hull);
  const angles = keepRotation ? [0] : [...new Set([0, 90, tight, tight + 90])];
  const turns = angles.map((degrees) => {
    const b = boundsOfPoints(rotatePoints(hull, degrees, pivot));
    return { degrees, width: b.maxX - b.minX, height: b.maxY - b.minY };
  });
  return { ids: new Set(members.map((o) => o.id)), hull, pivot, turns };
}

const partArea = (p: Part) => p.turns[0]!.width * p.turns[0]!.height;
const longestSide = (p: Part) => Math.max(p.turns[0]!.width, p.turns[0]!.height);

/** Big parts first fits most; trying a few notions of "big" and keeping the best is cheap. */
const ORDERS: ReadonlyArray<(a: Part, b: Part) => number> = [
  (a, b) => partArea(b) - partArea(a),
  (a, b) => longestSide(b) - longestSide(a),
  (a, b) => b.turns[0]!.height - a.turns[0]!.height,
  (a, b) => b.turns[0]!.width - a.turns[0]!.width,
];

/** Compares number lists in order: is `a` smaller at the first place they differ? */
const isLower = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i]! - b[i]!) > 1e-9) return a[i]! < b[i]!;
  return false;
};

/** How far down, then right, a placed part reaches. */
const reach = ({ turn, spot }: Placement) => [spot.y + turn.height, spot.x + turn.width];

function pack(parts: readonly Part[], bin: Rect, taken: readonly Rect[], gap: number) {
  const space = new FreeSpace(bin);
  taken.forEach((r) => space.occupy(r));
  const placements: Placement[] = [];
  for (const part of parts) {
    let best: Placement | null = null;
    for (const turn of part.turns) {
      const spot = space.bestSpot(turn.width + gap, turn.height + gap);
      if (!spot) continue;
      // Lowest bottom edge, then leftmost right edge: of the turns that fit in the
      // same spot, the flatter, narrower one wins and leaves more room.
      const candidate = { part, turn, spot };
      if (!best || isLower(reach(candidate), reach(best))) best = candidate;
    }
    if (!best) continue;
    space.occupy({ ...best.spot, width: best.turn.width + gap, height: best.turn.height + gap });
    placements.push(best);
  }
  // Fewest parts left out first, then the most compact (lowest, then narrowest) layout.
  const extent = (key: 'x' | 'y', size: 'width' | 'height') =>
    Math.max(0, ...placements.map((p) => p.spot[key] + p.turn[size]));
  return { placements, score: [-placements.length, extent('y', 'height'), extent('x', 'width')] };
}

const normalise = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** Moves (and turns) every shape of a placed part to its spot. */
function place(objects: readonly DesignObject[], { part, turn, spot }: Placement, gap: number) {
  const turned = boundsOfPoints(rotatePoints(part.hull, turn.degrees, part.pivot));
  const d = { x: spot.x + gap / 2 - turned.minX, y: spot.y + gap / 2 - turned.minY };
  return objects.map((o) => {
    if (!part.ids.has(o.id)) return o;
    const [corner] = rotatePoints(
      [{ x: o.transform.x, y: o.transform.y }],
      turn.degrees,
      part.pivot,
    );
    return {
      ...o,
      transform: {
        ...o.transform,
        x: corner!.x + d.x,
        y: corner!.y + d.y,
        rotation: normalise(o.transform.rotation + turn.degrees),
      },
    };
  });
}

/**
 * Packs the shapes in `ids` onto the stock around everything else, which
 * stays put. Parts that don't fit are left where they were.
 */
export function nestObjects(
  objects: readonly DesignObject[],
  ids: readonly string[],
  stock: Stock,
  { spacing, keepRotation }: NestOptions,
): NestResult {
  const moving = objects.filter((o) => ids.includes(o.id) && o.paths.length > 0);
  const parts = findParts(moving).map((members) => makePart(members, keepRotation));
  // Every part's box grows by the gap, so the stock shrinks by half of it on each side.
  const gap = Math.max(0, spacing);
  const bin = { x: gap / 2, y: gap / 2, width: stock.width - gap, height: stock.height - gap };
  const taken = objects
    .filter((o) => !ids.includes(o.id) && o.paths.length > 0)
    .map((o) => boundsOfPoints(outlinePoints(o)))
    .map((b) => ({
      x: b.minX - gap / 2,
      y: b.minY - gap / 2,
      width: b.maxX - b.minX + gap,
      height: b.maxY - b.minY + gap,
    }));

  let best = pack(parts, bin, taken, gap);
  for (const order of ORDERS) {
    const attempt = pack([...parts].sort(order), bin, taken, gap);
    if (isLower(attempt.score, best.score)) best = attempt;
  }
  const arranged = best.placements.reduce<readonly DesignObject[]>(
    (list, placement) => place(list, placement, gap),
    objects,
  );
  return {
    objects: [...arranged],
    placed: best.placements.length,
    leftOut: parts.length - best.placements.length,
  };
}
