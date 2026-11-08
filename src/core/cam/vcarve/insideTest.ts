import { boundsOfPaths, type Path, type Vec2 } from '../../geometry/path';

/** Edges are filed into this many horizontal bands, so a test only looks at nearby edges. */
const MAX_BANDS = 512;

/**
 * Even-odd point-in-shape test for closed paths (holes in letters count as
 * outside), quick enough to call for every Voronoi vertex: each test casts a
 * ray through only the edges in its band.
 */
export function insideTester(paths: readonly Path[]): (p: Vec2) => boolean {
  const b = boundsOfPaths(paths);
  const edges: number[] = []; // x1, y1, x2, y2 per edge
  for (const path of paths) {
    const pts = path.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      if (a.y !== c.y) edges.push(a.x, a.y, c.x, c.y);
    }
  }
  const count = edges.length / 4;
  const bands = Math.max(1, Math.min(MAX_BANDS, Math.ceil(Math.sqrt(count))));
  const height = (b.maxY - b.minY) / bands || 1;
  const bandOf = (y: number) => Math.min(bands - 1, Math.max(0, Math.floor((y - b.minY) / height)));
  const filed: number[][] = Array.from({ length: bands }, () => []);
  for (let e = 0; e < count; e++) {
    const y1 = edges[e * 4 + 1]!;
    const y2 = edges[e * 4 + 3]!;
    for (let band = bandOf(Math.min(y1, y2)); band <= bandOf(Math.max(y1, y2)); band++) {
      filed[band]!.push(e);
    }
  }

  return (p) => {
    if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return false;
    let inside = false;
    for (const e of filed[bandOf(p.y)]!) {
      const x1 = edges[e * 4]!;
      const y1 = edges[e * 4 + 1]!;
      const x2 = edges[e * 4 + 2]!;
      const y2 = edges[e * 4 + 3]!;
      if (y1 > p.y !== y2 > p.y && p.x < x1 + ((p.y - y1) * (x2 - x1)) / (y2 - y1)) {
        inside = !inside;
      }
    }
    return inside;
  };
}
