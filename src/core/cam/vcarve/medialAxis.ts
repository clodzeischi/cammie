import { Delaunay } from 'd3-delaunay';
import { pathLength, type Path } from '../../geometry/path';
import { insideTester } from './insideTest';

/** A point on the centre line, with how far it is from the nearest edge (mm). */
export interface MedialPoint {
  x: number;
  y: number;
  r: number;
}

export interface MedialAxis {
  /** Polylines through the middle of the shape; joints are shared end points. */
  chains: MedialPoint[][];
  /** Spacing the outlines were sampled at (mm). */
  spacing: number;
}

/** Outlines are sampled this densely (SPEC.md §9.5) unless that's too many points. */
export const SAMPLE_SPACING = 0.05;
/** Above this many samples the spacing grows, to keep the work bounded. */
const MAX_SAMPLES = 200_000;
/**
 * A centre-line edge is kept only where its two nearest edge points are at
 * least this far apart as seen from it (radians). That keeps the branches
 * into corners up to 150° and drops the noise between neighbouring samples.
 */
const MIN_SPREAD = (30 * Math.PI) / 180;

interface Samples {
  coords: Float64Array;
  /** Which loop each sample is on, and its index along that loop. */
  loop: Int32Array;
  index: Int32Array;
  loopSize: number[];
}

function sample(paths: readonly Path[], spacing: number): Samples {
  const xs: number[] = [];
  const loop: number[] = [];
  const index: number[] = [];
  const loopSize: number[] = [];
  paths.forEach((path, l) => {
    const pts = path.points;
    let n = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing);
      for (let k = 0; k < steps; k++) {
        xs.push(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
        loop.push(l);
        index.push(n++);
      }
    }
    loopSize.push(n);
  });
  return {
    coords: Float64Array.from(xs),
    loop: Int32Array.from(loop),
    index: Int32Array.from(index),
    loopSize,
  };
}

/**
 * The medial axis of closed shapes (even-odd, so holes in letters stay
 * uncut): the lines of points equally far from two or more edges. Built from
 * the Voronoi diagram of densely sampled outlines; edges that leave the shape,
 * or that separate neighbouring samples, are dropped. Each point carries its
 * distance to the outline, which sets how deep a V-bit goes there.
 */
export function medialAxis(paths: readonly Path[]): MedialAxis {
  const closed = paths.filter((p) => p.closed && p.points.length > 2);
  const perimeter = closed.reduce((sum, p) => sum + pathLength(p), 0);
  const spacing = Math.max(SAMPLE_SPACING, perimeter / MAX_SAMPLES);
  if (closed.length === 0) return { chains: [], spacing };

  const s = sample(closed, spacing);
  const { triangles, halfedges } = new Delaunay(s.coords);
  const inside = insideTester(closed);

  // Each triangle's circumcentre is a Voronoi vertex, equally far from its three samples.
  const triangleCount = triangles.length / 3;
  const centre = new Float64Array(triangleCount * 3); // x, y, r
  const usable = new Uint8Array(triangleCount);
  for (let t = 0; t < triangleCount; t++) {
    const a = triangles[t * 3]! * 2;
    const b = triangles[t * 3 + 1]! * 2;
    const c = triangles[t * 3 + 2]! * 2;
    const ax = s.coords[a]!;
    const ay = s.coords[a + 1]!;
    const bx = s.coords[b]! - ax;
    const by = s.coords[b + 1]! - ay;
    const cx = s.coords[c]! - ax;
    const cy = s.coords[c + 1]! - ay;
    const d = 2 * (bx * cy - by * cx);
    if (Math.abs(d) < 1e-12) continue; // three samples in a line
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const ux = (cy * b2 - by * c2) / d;
    const uy = (bx * c2 - cx * b2) / d;
    centre[t * 3] = ax + ux;
    centre[t * 3 + 1] = ay + uy;
    centre[t * 3 + 2] = Math.hypot(ux, uy);
    usable[t] = inside({ x: ax + ux, y: ay + uy }) ? 1 : 0;
  }

  const neighbours = (i: number, j: number) => {
    if (s.loop[i] !== s.loop[j]) return false;
    const gap = Math.abs(s.index[i]! - s.index[j]!);
    return Math.min(gap, s.loopSize[s.loop[i]!]! - gap) <= 2;
  };

  // Voronoi edges: one per interior Delaunay edge, joining the two triangles' centres.
  const adjacency = new Map<number, number[]>();
  const link = (from: number, to: number) => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (let e = 0; e < halfedges.length; e++) {
    const o = halfedges[e]!;
    if (o < e) continue; // hull edge (−1), or already seen from the other side
    const t1 = Math.floor(e / 3);
    const t2 = Math.floor(o / 3);
    if (!usable[t1] || !usable[t2]) continue;
    const i = triangles[e]!;
    const j = triangles[e % 3 === 2 ? e - 2 : e + 1]!;
    if (neighbours(i, j)) continue;
    const half =
      Math.hypot(s.coords[2 * i]! - s.coords[2 * j]!, s.coords[2 * i + 1]! - s.coords[2 * j + 1]!) /
      2;
    const spread = (t: number) => 2 * Math.asin(Math.min(1, half / centre[t * 3 + 2]!));
    if (Math.max(spread(t1), spread(t2)) < MIN_SPREAD) continue;
    link(t1, t2);
    link(t2, t1);
  }

  const point = (t: number): MedialPoint => ({
    x: centre[t * 3]!,
    y: centre[t * 3 + 1]!,
    r: centre[t * 3 + 2]!,
  });
  const chains = chainUp(adjacency).map((nodes) => nodes.map(point));
  return { chains: pruneStubs(chains, spacing), spacing };
}

/**
 * Splits a graph into polylines that run between joints and ends (nodes not
 * linked to exactly two others). Loops with no joint come out closed, first
 * point repeated at the end.
 */
function chainUp(adjacency: Map<number, number[]>): number[][] {
  const done = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const chains: number[][] = [];
  const walk = (start: number, next: number) => {
    const chain = [start];
    let prev = start;
    let here = next;
    done.add(key(start, next));
    for (;;) {
      chain.push(here);
      const links = adjacency.get(here)!;
      if (links.length !== 2 || here === start) break;
      const ahead = links[0] === prev ? links[1]! : links[0]!;
      if (done.has(key(here, ahead))) break;
      done.add(key(here, ahead));
      prev = here;
      here = ahead;
    }
    chains.push(chain);
  };
  for (const [node, links] of adjacency) {
    if (links.length === 2) continue;
    for (const next of links) if (!done.has(key(node, next))) walk(node, next);
  }
  for (const [node, links] of adjacency) {
    for (const next of links) if (!done.has(key(node, next))) walk(node, next);
  }
  return chains;
}

const chainLength = (chain: readonly MedialPoint[]) =>
  chain.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - chain[i - 1]!.x, p.y - chain[i - 1]!.y)),
    0,
  );

/** Drops dead-end twigs a few samples long: sampling noise, too small to carve anything. */
function pruneStubs(chains: MedialPoint[][], spacing: number): MedialPoint[][] {
  const degree = new Map<string, number>();
  const at = (p: MedialPoint) => `${p.x}|${p.y}`;
  for (const chain of chains) {
    for (const end of [chain[0]!, chain[chain.length - 1]!]) {
      degree.set(at(end), (degree.get(at(end)) ?? 0) + 1);
    }
  }
  return chains.filter((chain) => {
    const loose = degree.get(at(chain[0]!)) === 1 || degree.get(at(chain[chain.length - 1]!)) === 1;
    const joined = degree.get(at(chain[0]!))! > 1 || degree.get(at(chain[chain.length - 1]!))! > 1;
    return !(loose && joined && chainLength(chain) < 3 * spacing);
  });
}
