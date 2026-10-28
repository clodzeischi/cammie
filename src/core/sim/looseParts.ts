import { isSolid, type HeightField } from './heightField';

/** A piece of stock no longer attached to anything: it'll come loose when cut. */
export interface LoosePart {
  /** Its cells' label in `PartMap.labels`. */
  label: number;
  /** Cell bounds (inclusive). */
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  cells: number;
}

export interface PartMap {
  /** Per cell: 0 where cut through, otherwise the label of the piece it belongs to. */
  labels: Int32Array;
  /** Pieces that don't reach the edge of the stock, where it's clamped or taped down. */
  loose: LoosePart[];
}

/**
 * Splits the remaining material into connected pieces (edge-adjacent cells).
 * Anything touching the stock's outer edge is held; tabs keep a part joined to
 * its surroundings, so only parts cut free without tabs, and the slugs of
 * holes, come out loose.
 */
export function findParts(field: HeightField): PartMap {
  const { cols, rows } = field;
  const labels = new Int32Array(cols * rows);
  const loose: LoosePart[] = [];
  const stack = new Int32Array(cols * rows);
  let next = 1;

  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== 0 || !isSolid(field, start)) continue;
    const label = next++;
    const part = { label, minCol: cols, maxCol: -1, minRow: rows, maxRow: -1, cells: 0 };
    let held = false;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const i = stack[--top]!;
      const col = i % cols;
      const row = (i - col) / cols;
      part.cells++;
      part.minCol = Math.min(part.minCol, col);
      part.maxCol = Math.max(part.maxCol, col);
      part.minRow = Math.min(part.minRow, row);
      part.maxRow = Math.max(part.maxRow, row);
      if (col === 0 || row === 0 || col === cols - 1 || row === rows - 1) held = true;
      const visit = (j: number) => {
        if (labels[j] === 0 && isSolid(field, j)) {
          labels[j] = label;
          stack[top++] = j;
        }
      };
      if (col > 0) visit(i - 1);
      if (col < cols - 1) visit(i + 1);
      if (row > 0) visit(i - cols);
      if (row < rows - 1) visit(i + cols);
    }
    if (!held) loose.push(part);
  }
  return { labels, loose };
}
