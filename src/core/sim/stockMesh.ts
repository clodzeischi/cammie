import { isSolid, type HeightField } from './heightField';
import type { LoosePart, PartMap } from './looseParts';

/** Triangles ready for a renderer. World space: X right, Y up the stock (machine Y), Z up. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface StockMeshes {
  /** Everything still attached to the stock's edge, with its outer walls. */
  board: MeshData;
  /** Pieces that come loose, each on its own so the viewer can lift it out. */
  loose: Array<{ part: LoosePart; mesh: MeshData }>;
}

/** Cell range a mesh covers (inclusive). */
interface Span {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/** Collects vertices and triangles; grows as it goes. */
class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private indices: number[] = [];
  private count = 0;

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    const length = Math.hypot(nx, ny, nz) || 1;
    this.positions.push(x, y, z);
    this.normals.push(nx / length, ny / length, nz / length);
    return this.count++;
  }

  triangle(a: number, b: number, c: number) {
    this.indices.push(a, b, c);
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      indices: new Uint32Array(this.indices),
    };
  }
}

/**
 * Builds the visible surfaces of the cut stock: the board, and each loose
 * piece on its own. A grid square is drawn when any of its corners still has
 * material of that piece; corners that are cut through sit where the top and
 * bottom surfaces meet, so cut walls and holes close up without gaps.
 */
export function buildStockMeshes(field: HeightField, parts: PartMap): StockMeshes {
  const looseLabels = new Set(parts.loose.map((p) => p.label));
  const isBoard = (label: number) => label !== 0 && !looseLabels.has(label);
  const all: Span = { minCol: 0, maxCol: field.cols - 1, minRow: 0, maxRow: field.rows - 1 };

  const board = new MeshBuilder();
  surface(field, parts.labels, isBoard, all, board);
  outerWalls(field, board);

  return {
    board: board.build(),
    loose: parts.loose.map((part) => {
      const mesh = new MeshBuilder();
      // One cell of margin takes in the cut-through ring around the piece.
      const span = {
        minCol: Math.max(0, part.minCol - 1),
        maxCol: Math.min(field.cols - 1, part.maxCol + 1),
        minRow: Math.max(0, part.minRow - 1),
        maxRow: Math.min(field.rows - 1, part.maxRow + 1),
      };
      surface(field, parts.labels, (label) => label === part.label, span, mesh);
      return { part, mesh: mesh.build() };
    }),
  };
}

/** Where a cell's top and bottom surfaces are drawn: cut-through cells close up in the middle. */
function heights(field: HeightField, i: number): [number, number] {
  const top = field.top[i]!;
  const bottom = field.bottom[i]!;
  if (isSolid(field, i)) return [top, bottom];
  const middle = (top + bottom) / 2;
  return [middle, middle];
}

/** Top and bottom surfaces of the cells that pass `belongs`, within `span`. */
function surface(
  field: HeightField,
  labels: Int32Array,
  belongs: (label: number) => boolean,
  span: Span,
  out: MeshBuilder,
) {
  const { cols, cell } = field;
  const width = span.maxCol - span.minCol + 1;
  const height = span.maxRow - span.minRow + 1;
  const topIndex = new Int32Array(width * height).fill(-1);
  const bottomIndex = new Int32Array(width * height).fill(-1);
  const worldY = (row: number) => (field.rows - row - 0.5) * cell;
  const at = (col: number, row: number) => row * cols + col;
  const z = (col: number, row: number, side: 0 | 1) => {
    const c = Math.min(Math.max(col, span.minCol), span.maxCol);
    const r = Math.min(Math.max(row, span.minRow), span.maxRow);
    return heights(field, at(c, r))[side];
  };

  const vertex = (col: number, row: number, side: 0 | 1): number => {
    const local = (row - span.minRow) * width + (col - span.minCol);
    const cache = side === 0 ? topIndex : bottomIndex;
    if (cache[local]! >= 0) return cache[local]!;
    // Slope from neighbours; world Y runs opposite to rows.
    const dzdx = (z(col + 1, row, side) - z(col - 1, row, side)) / (2 * cell);
    const dzdy = -(z(col, row + 1, side) - z(col, row - 1, side)) / (2 * cell);
    const sign = side === 0 ? 1 : -1;
    const x = (col + 0.5) * cell;
    cache[local] = out.vertex(x, worldY(row), z(col, row, side), -sign * dzdx, -sign * dzdy, sign);
    return cache[local]!;
  };

  for (let row = span.minRow; row < span.maxRow; row++) {
    for (let col = span.minCol; col < span.maxCol; col++) {
      const corners = [at(col, row), at(col + 1, row), at(col, row + 1), at(col + 1, row + 1)];
      const solid = corners.filter((i) => isSolid(field, i));
      // Skip squares that are all cut away or that touch another piece.
      if (solid.length === 0 || !solid.every((i) => belongs(labels[i]!))) continue;
      for (const side of [0, 1] as const) {
        const a = vertex(col, row, side);
        const b = vertex(col + 1, row, side);
        const c = vertex(col, row + 1, side);
        const d = vertex(col + 1, row + 1, side);
        // Counter-clockwise seen from outside: from above for the top, from below for the bottom.
        if (side === 0) {
          out.triangle(a, c, b);
          out.triangle(b, c, d);
        } else {
          out.triangle(a, b, c);
          out.triangle(b, d, c);
        }
      }
    }
  }
}

/** The stock's four outer sides, from the bottom surface up to the top. */
function outerWalls(field: HeightField, out: MeshBuilder) {
  const { cols, rows, cell } = field;
  const edge = (cells: Array<[number, number]>, nx: number, ny: number, flip: boolean) => {
    for (let k = 0; k + 1 < cells.length; k++) {
      const [c0, r0] = cells[k]!;
      const [c1, r1] = cells[k + 1]!;
      const i0 = r0 * cols + c0;
      const i1 = r1 * cols + c1;
      if (!isSolid(field, i0) && !isSolid(field, i1)) continue;
      const [t0, b0] = heights(field, i0);
      const [t1, b1] = heights(field, i1);
      const p = (c: number, r: number, z: number) =>
        out.vertex((c + 0.5) * cell, (rows - r - 0.5) * cell, z, nx, ny, 0);
      const a = p(c0, r0, b0);
      const b = p(c1, r1, b1);
      const c = p(c0, r0, t0);
      const d = p(c1, r1, t1);
      if (flip) {
        out.triangle(a, c, b);
        out.triangle(b, c, d);
      } else {
        out.triangle(a, b, c);
        out.triangle(b, d, c);
      }
    }
  };
  const along = (n: number, f: (k: number) => [number, number]) =>
    Array.from({ length: n }, (_, k) => f(k));
  edge(
    along(cols, (k) => [k, rows - 1]),
    0,
    -1,
    false,
  ); // front (machine Y = 0)
  edge(
    along(cols, (k) => [k, 0]),
    0,
    1,
    true,
  ); // back
  edge(
    along(rows, (k) => [0, k]),
    -1,
    0,
    false,
  ); // left
  edge(
    along(rows, (k) => [cols - 1, k]),
    1,
    0,
    true,
  ); // right
}
