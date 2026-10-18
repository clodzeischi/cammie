import { distance, type Path, type Vec2 } from '../../geometry/path';

/**
 * A closed loop measured by distance along it ("s", in mm). Positions past the
 * perimeter wrap around, so callers can walk several laps with a growing s.
 */
export class Loop {
  readonly points: Vec2[];
  /** cumulative[i] = distance from points[0] to points[i]; the last entry is the perimeter. */
  private readonly cumulative: number[];
  readonly perimeter: number;

  constructor(path: Path) {
    this.points = path.points;
    this.cumulative = [0];
    for (let i = 1; i <= this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i % this.points.length]!;
      this.cumulative.push(this.cumulative[i - 1]! + distance(a, b));
    }
    this.perimeter = this.cumulative[this.cumulative.length - 1]!;
  }

  private wrap(s: number): number {
    const r = s % this.perimeter;
    return r < 0 ? r + this.perimeter : r;
  }

  /** Index of the segment containing wrapped position `s` (binary search). */
  private segmentAt(s: number): number {
    let lo = 0;
    let hi = this.points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cumulative[mid]! <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  pointAt(s: number): Vec2 {
    const w = this.wrap(s);
    const i = this.segmentAt(w);
    const a = this.points[i]!;
    const b = this.points[(i + 1) % this.points.length]!;
    const length = this.cumulative[i + 1]! - this.cumulative[i]!;
    const t = length === 0 ? 0 : (w - this.cumulative[i]!) / length;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Vertex positions strictly between s0 and s1 (unwrapped, may span laps). */
  vertexPositionsBetween(s0: number, s1: number): number[] {
    const out: number[] = [];
    const firstLap = Math.floor(s0 / this.perimeter);
    for (let lap = firstLap; lap * this.perimeter < s1; lap++) {
      for (let i = 0; i < this.points.length; i++) {
        const s = lap * this.perimeter + this.cumulative[i]!;
        if (s > s0 && s < s1) out.push(s);
      }
    }
    return out;
  }

  /** Position on the loop nearest to `p`, with the distance to it. */
  closest(p: Vec2): { s: number; distance: number } {
    let best = { s: 0, distance: Infinity };
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i]!;
      const b = this.points[(i + 1) % this.points.length]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy;
      const t =
        lengthSq === 0
          ? 0
          : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
      const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (d < best.distance) {
        best = { s: this.cumulative[i]! + t * Math.sqrt(lengthSq), distance: d };
      }
    }
    return best;
  }

  /** Is wrapped position `s` inside any of the [start, end] intervals (which may wrap)? */
  inIntervals(s: number, intervals: ReadonlyArray<[number, number]>): boolean {
    const w = this.wrap(s);
    return intervals.some(([a, b]) => {
      const wa = this.wrap(a);
      const length = b - a;
      if (length >= this.perimeter) return true;
      const offset = this.wrap(w - wa);
      return offset <= length;
    });
  }

  /** Interval boundaries (unwrapped) that fall strictly between s0 and s1. */
  intervalBoundariesBetween(
    s0: number,
    s1: number,
    intervals: ReadonlyArray<[number, number]>,
  ): number[] {
    const out: number[] = [];
    for (const [a, b] of intervals) {
      for (const edge of [a, b]) {
        const w = this.wrap(edge);
        const firstLap = Math.floor(s0 / this.perimeter);
        for (let lap = firstLap; lap * this.perimeter < s1; lap++) {
          const s = lap * this.perimeter + w;
          if (s > s0 && s < s1) out.push(s);
        }
      }
    }
    return out;
  }
}
