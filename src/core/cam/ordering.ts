import { distance, type Path, type Vec2 } from '../geometry/path';

interface Candidate {
  index: number;
  /** Closed loops: vertex to start at. Open paths: whether to run it backwards. */
  startVertex: number;
  reversed: boolean;
  dist: number;
}

function bestEntry(path: Path, index: number, from: Vec2): Candidate {
  const { points } = path;
  if (path.closed) {
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = distance(from, p);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return { index, startVertex: best, reversed: false, dist: bestDist };
  }
  const toStart = distance(from, points[0]!);
  const toEnd = distance(from, points[points.length - 1]!);
  return { index, startVertex: 0, reversed: toEnd < toStart, dist: Math.min(toStart, toEnd) };
}

function orient(path: Path, c: Candidate): Path {
  if (path.closed) {
    const points = [...path.points.slice(c.startVertex), ...path.points.slice(0, c.startVertex)];
    return { closed: true, points };
  }
  return { closed: false, points: c.reversed ? [...path.points].reverse() : path.points.slice() };
}

const endOf = (path: Path): Vec2 =>
  path.closed ? path.points[0]! : path.points[path.points.length - 1]!;

/**
 * Greedy nearest-neighbour ordering to cut down travel moves. Closed loops are
 * rotated to start at the vertex nearest the tool; open paths may be reversed.
 */
export function orderPaths(paths: readonly Path[], start: Vec2): { paths: Path[]; end: Vec2 } {
  const remaining = new Set(paths.map((_, i) => i).filter((i) => paths[i]!.points.length > 0));
  const ordered: Path[] = [];
  let position = start;

  while (remaining.size > 0) {
    let best: Candidate | null = null;
    for (const index of remaining) {
      const candidate = bestEntry(paths[index]!, index, position);
      if (!best || candidate.dist < best.dist) best = candidate;
    }
    remaining.delete(best!.index);
    const path = orient(paths[best!.index]!, best!);
    ordered.push(path);
    position = endOf(path);
  }
  return { paths: ordered, end: position };
}
