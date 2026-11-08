/** An axis-aligned rectangle: top-left corner and size (canvas mm, Y down). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPS = 1e-9;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width - EPS &&
  b.x < a.x + a.width - EPS &&
  a.y < b.y + b.height - EPS &&
  b.y < a.y + a.height - EPS;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  inner.x + inner.width <= outer.x + outer.width + EPS &&
  inner.y + inner.height <= outer.y + outer.height + EPS;

/** The parts of `free` left after taking `used` out: up to four overlapping strips. */
function split(free: Rect, used: Rect): Rect[] {
  if (!overlaps(free, used)) return [free];
  const out: Rect[] = [];
  const right = free.x + free.width;
  const bottom = free.y + free.height;
  if (used.x > free.x) out.push({ ...free, width: used.x - free.x });
  if (used.x + used.width < right) {
    out.push({ ...free, x: used.x + used.width, width: right - used.x - used.width });
  }
  if (used.y > free.y) out.push({ ...free, height: used.y - free.y });
  if (used.y + used.height < bottom) {
    out.push({ ...free, y: used.y + used.height, height: bottom - used.y - used.height });
  }
  return out.filter((r) => r.width > EPS && r.height > EPS);
}

/**
 * Free space in a rectangular bin, kept as the list of largest empty
 * rectangles (they may overlap), as in the MaxRects packing method.
 */
export class FreeSpace {
  private free: Rect[];

  constructor(bin: Rect) {
    this.free = bin.width > 0 && bin.height > 0 ? [bin] : [];
  }

  /** Marks `used` as taken (a placed part, or something already on the stock). */
  occupy(used: Rect) {
    const next = this.free.flatMap((f) => split(f, used));
    // Drop rectangles inside others: they add nothing and slow every search.
    // Of two identical rectangles, the first is kept.
    this.free = next.filter(
      (r, i) => !next.some((o, j) => j !== i && contains(o, r) && (j < i || !contains(r, o))),
    );
  }

  /**
   * Where a width × height part fits best: as high up, then as far left, as
   * possible. Packing into one corner like this leaves the rest of the stock
   * as one large empty area.
   */
  bestSpot(width: number, height: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    for (const f of this.free) {
      if (width > f.width + EPS || height > f.height + EPS) continue;
      const better = !best || f.y < best.y - EPS || (Math.abs(f.y - best.y) <= EPS && f.x < best.x);
      if (better) best = { x: f.x, y: f.y };
    }
    return best;
  }
}
