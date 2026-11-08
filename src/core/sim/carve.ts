import type { HeightField } from './heightField';
import type { ToolShape } from './toolShape';

/** A tool position: X/Y in canvas mm, Z in machine Z (0 = top of the stock). */
export interface ToolPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Removes everything the tool sweeps moving in a straight line from `a` to
 * `b`.
 *
 * For each cell the tool is taken at the point of the move nearest the cell
 * (and at both ends, for ramps); exact for level moves and plunges, and
 * within a cell for the shallow ramps Cammie writes.
 */
export function carveMove(field: HeightField, tool: ToolShape, a: ToolPoint, b: ToolPoint): void {
  if (Math.min(a.z, b.z) >= 0) return; // above the surface the whole way
  const { cols, rows, cell, thickness, top, spoil } = field;
  const r = tool.radius;
  const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - r) / cell));
  const c1 = Math.min(cols - 1, Math.floor((Math.max(a.x, b.x) + r) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - r) / cell));
  const r1 = Math.min(rows - 1, Math.floor((Math.max(a.y, b.y) + r) / cell));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  /** Height of the tool's cutting surface over the cell centre with the tip at `t` along the move. */
  const surfaceAt = (t: number, cx: number, cy: number) => {
    const d = Math.hypot(a.x + dx * t - cx, a.y + dy * t - cy);
    return a.z + (b.z - a.z) * t + tool.heightAt(d);
  };

  for (let row = r0; row <= r1; row++) {
    const cy = (row + 0.5) * cell;
    for (let col = c0; col <= c1; col++) {
      const cx = (col + 0.5) * cell;
      const along = lengthSq > 0 ? ((cx - a.x) * dx + (cy - a.y) * dy) / lengthSq : 0;
      const t = Math.min(Math.max(along, 0), 1);
      const z = Math.min(surfaceAt(t, cx, cy), surfaceAt(0, cx, cy), surfaceAt(1, cx, cy));
      if (z >= 0) continue;
      const i = row * cols + col;
      const past = -z - thickness;
      if (past > spoil[i]!) spoil[i] = past;
      top[i] = Math.min(top[i]!, Math.max(z, -thickness));
    }
  }
}
