import type { Vec2 } from '../../geometry/path';
import type { Vertex3 } from '../toolpath/loopPass';

/** Carve lines are simplified to within this (mm), in X/Y and Z. */
const SIMPLIFY_TOLERANCE = 0.01;
const SAME_POINT = 1e-6;

const key = (p: Vec2) => `${p.x}|${p.y}`;
const flatDistance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Groups chains that touch into pieces (roughly one per letter), each joined
 * into as few continuous lines as possible, so the tool carves one piece
 * completely, mostly without lifting, before moving to the next. Pieces and
 * lines are visited nearest first from `start`.
 */
export function carveLines<T extends Vec2>(chains: readonly T[][], start: Vec2): T[][][] {
  const pieces = connectedPieces(chains);
  const result: T[][][] = [];
  let here = start;
  const remaining = [...pieces];
  while (remaining.length > 0) {
    let best = 0;
    let bestDistance = Infinity;
    remaining.forEach((piece, i) => {
      for (const chain of piece) {
        for (const end of [chain[0]!, chain[chain.length - 1]!]) {
          const d = flatDistance(here, end);
          if (d < bestDistance) [best, bestDistance] = [i, d];
        }
      }
    });
    const lines = walkPiece(remaining.splice(best, 1)[0]!, here);
    result.push(lines);
    const lastLine = lines[lines.length - 1]!;
    here = lastLine[lastLine.length - 1]!;
  }
  return result;
}

function connectedPieces<T extends Vec2>(chains: readonly T[][]): T[][][] {
  const parent = chains.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const owner = new Map<string, number>();
  chains.forEach((chain, i) => {
    for (const end of [chain[0]!, chain[chain.length - 1]!]) {
      const other = owner.get(key(end));
      if (other === undefined) owner.set(key(end), i);
      else parent[find(i)] = find(other);
    }
  });
  const groups = new Map<number, T[][]>();
  chains.forEach((chain, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(chain);
    else groups.set(root, [chain]);
  });
  return [...groups.values()];
}

/**
 * Joins one piece's chains into continuous lines: from the end nearest
 * `start`, keep taking an unused chain at the current joint; when there's
 * none, start a new line at the nearest unused end (preferring dead ends).
 */
function walkPiece<T extends Vec2>(piece: T[][], start: Vec2): T[][] {
  const ends = new Map<string, number[]>();
  piece.forEach((chain, i) => {
    for (const end of [chain[0]!, chain[chain.length - 1]!]) {
      const list = ends.get(key(end));
      if (list) list.push(i);
      else ends.set(key(end), [i]);
    }
  });
  const used = new Uint8Array(piece.length);
  const oriented = (i: number, from: T) => {
    const chain = piece[i]!;
    return key(chain[0]!) === key(from) ? chain : [...chain].reverse();
  };

  const lines: T[][] = [];
  let here: Vec2 = start;
  for (let left = piece.length; left > 0;) {
    // Start at the nearest unused end; dead ends first, so lines don't stop at joints.
    let first = -1;
    let from: T | null = null;
    let bestScore = Infinity;
    piece.forEach((chain, i) => {
      if (used[i]) return;
      for (const end of [chain[0]!, chain[chain.length - 1]!]) {
        const deadEnd = (ends.get(key(end))?.length ?? 0) === 1;
        const score = flatDistance(here, end) + (deadEnd ? 0 : 1e6);
        if (score < bestScore) [first, from, bestScore] = [i, end, score];
      }
    });
    const line: T[] = [];
    for (let i = first; i >= 0;) {
      used[i] = 1;
      left--;
      const chain = oriented(i, from!);
      line.push(...(line.length > 0 ? chain.slice(1) : chain));
      from = chain[chain.length - 1]!;
      i = (ends.get(key(from)) ?? []).find((j) => !used[j]) ?? -1;
    }
    lines.push(line);
    here = line[line.length - 1]!;
  }
  return lines;
}

/** Douglas–Peucker in 3D: drops points the line passes within `tolerance` of anyway. */
export function simplify3(points: readonly Vertex3[], tolerance = SIMPLIFY_TOLERANCE): Vertex3[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const p = points[a]!;
    const q = points[b]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const dz = q.z - p.z;
    const length2 = dx * dx + dy * dy + dz * dz;
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = a + 1; i < b; i++) {
      const v = points[i]!;
      const t =
        length2 > 0
          ? Math.max(
              0,
              Math.min(1, ((v.x - p.x) * dx + (v.y - p.y) * dy + (v.z - p.z) * dz) / length2),
            )
          : 0;
      const d = Math.hypot(v.x - p.x - t * dx, v.y - p.y - t * dy, v.z - p.z - t * dz);
      if (d > worstDistance) [worst, worstDistance] = [i, d];
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** `line` with a point added wherever it crosses height `z`. */
function splitAt(line: readonly Vertex3[], z: number): Vertex3[] {
  const out: Vertex3[] = [];
  line.forEach((v, i) => {
    const prev = line[i - 1];
    if (prev && (prev.z - z) * (v.z - z) < 0) {
      const t = (z - prev.z) / (v.z - prev.z);
      out.push({ x: prev.x + (v.x - prev.x) * t, y: prev.y + (v.y - prev.y) * t, z });
    }
    out.push(v);
  });
  return out;
}

/**
 * The stretches of `line` deeper than `above` (a negative Z: the floor the
 * last pass reached), flattened at `floor`. The line is split exactly where
 * it crosses both heights, so each pass takes off just what the one before
 * couldn't reach and the slopes in between come out true.
 */
export function passRuns(line: readonly Vertex3[], above: number, floor: number): Vertex3[][] {
  const runs: Vertex3[][] = [];
  let run: Vertex3[] = [];
  let lastShallow: Vertex3 | null = null;
  for (const v of splitAt(splitAt(line, above), floor)) {
    if (v.z < above - SAME_POINT) {
      // Starts where it dips below the last floor (that point was kept as shallow).
      if (run.length === 0 && lastShallow) run.push(lastShallow);
      run.push({ x: v.x, y: v.y, z: Math.max(v.z, floor) });
    } else {
      if (run.length > 0) {
        run.push(v);
        runs.push(run);
        run = [];
      }
      lastShallow = v;
    }
  }
  if (run.length > 0) runs.push(run);
  return runs;
}
