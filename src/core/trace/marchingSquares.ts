import type { Path, Vec2 } from '../geometry/path';

/**
 * Extracts the closed outlines where `field` crosses `level`, with sub-pixel
 * accuracy (crossings are interpolated between samples).
 *
 * `field` holds one value per pixel; values above `level` are "ink".
 * Output points are in pixel units, where the image spans [0, width] × [0, height]
 * and sample (x, y) sits at the pixel centre (x + 0.5, y + 0.5).
 * The field is padded with a one-pixel border of "no ink", so every outline closes;
 * outlines that hit the border run exactly along the image edge.
 */
export function traceContours(
  field: Float32Array,
  width: number,
  height: number,
  level: number,
): Path[] {
  // Padded grid: sample (sx, sy) is pixel (sx - 1, sy - 1); the ring around it is padding.
  const W = width + 2;
  const isPadding = (sx: number, sy: number) => sx < 1 || sy < 1 || sx > width || sy > height;
  const value = (sx: number, sy: number) =>
    isPadding(sx, sy) ? -Infinity : field[(sy - 1) * width + sx - 1]!;

  // Each crossing lives on one grid edge; edges get integer keys.
  const hEdge = (sx: number, sy: number) => 2 * (sy * W + sx); // (sx,sy)–(sx+1,sy)
  const vEdge = (sx: number, sy: number) => 2 * (sy * W + sx) + 1; // (sx,sy)–(sx,sy+1)
  const points = new Map<number, Vec2>();
  const next = new Map<number, number>();

  const crossing = (key: number, ax: number, ay: number, bx: number, by: number) => {
    if (!points.has(key)) {
      const padded = isPadding(ax, ay) || isPadding(bx, by);
      const t = padded ? 0.5 : (level - value(ax, ay)) / (value(bx, by) - value(ax, ay));
      points.set(key, { x: ax + t * (bx - ax) - 0.5, y: ay + t * (by - ay) - 0.5 });
    }
    return key;
  };

  const corners: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  for (let cy = 0; cy <= height; cy++) {
    for (let cx = 0; cx <= width; cx++) {
      // Corners clockwise: top-left, top-right, bottom-right, bottom-left.
      const v0 = value(cx, cy);
      const v1 = value(cx + 1, cy);
      const v2 = value(cx + 1, cy + 1);
      const v3 = value(cx, cy + 1);
      const mask =
        (v0 > level ? 8 : 0) | (v1 > level ? 4 : 0) | (v2 > level ? 2 : 0) | (v3 > level ? 1 : 0);
      if (mask === 0 || mask === 15) continue;

      const ink = [v0 > level, v1 > level, v2 > level, v3 > level];
      const edgeKeys = [hEdge(cx, cy), vEdge(cx + 1, cy), hEdge(cx, cy + 1), vEdge(cx, cy)];

      // Walking clockwise, an "exit" edge goes ink → no ink and an "entry" edge the reverse.
      const crossings: Array<{ key: number; entry: boolean }> = [];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        if (ink[i] === ink[j]) continue;
        const [ax, ay] = corners[i]!;
        const [bx, by] = corners[j]!;
        const key = crossing(edgeKeys[i]!, cx + ax, cy + ay, cx + bx, cy + by);
        crossings.push({ key, entry: !ink[i] });
      }

      // Segments always run entry → exit, so neighbouring cells chain up consistently.
      if (crossings.length === 2) {
        const entry = crossings[0]!.entry ? crossings[0]! : crossings[1]!;
        const exit = crossings[0]!.entry ? crossings[1]! : crossings[0]!;
        next.set(entry.key, exit.key);
      } else {
        // Saddle: two diagonal ink corners. The cell centre decides whether they connect.
        // (Saddles never touch padding: padding cells have at most one row/column of ink.)
        const centreInk = (v0 + v1 + v2 + v3) / 4 > level;
        const step = centreInk ? 3 : 1; // previous exit (connected) or next exit (separate)
        crossings.forEach((c, i) => {
          if (c.entry) next.set(c.key, crossings[(i + step) % 4]!.key);
        });
      }
    }
  }

  return linkLoops(points, next);
}

function linkLoops(points: Map<number, Vec2>, next: Map<number, number>): Path[] {
  const loops: Path[] = [];
  const visited = new Set<number>();
  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    const loop: Vec2[] = [];
    let key: number | undefined = start;
    while (key !== undefined && !visited.has(key)) {
      visited.add(key);
      loop.push(points.get(key)!);
      key = next.get(key);
    }
    if (loop.length >= 3) loops.push({ closed: true, points: loop });
  }
  return loops;
}
