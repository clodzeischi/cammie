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

/**
 * Where each cell's surfaces are drawn, worked out once for all meshes.
 * Cut-through cells close up halfway between the two surfaces.
 */
interface Surfaces {
  field: HeightField;
  solid: Uint8Array;
  /** Index 0: top surface, 1: bottom surface. */
  z: [Float32Array, Float32Array];
}

function surfacesOf(field: HeightField): Surfaces {
  const size = field.cols * field.rows;
  const solid = new Uint8Array(size);
  const top = new Float32Array(size);
  const bottom = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    if (isSolid(field, i)) {
      solid[i] = 1;
      top[i] = field.top[i]!;
      bottom[i] = field.bottom[i]!;
    } else {
      top[i] = bottom[i] = (field.top[i]! + field.bottom[i]!) / 2;
    }
  }
  return { field, solid, z: [top, bottom] };
}

/** Collects vertices and triangles in typed arrays, doubling them as it goes. */
class MeshBuilder {
  private positions: Float32Array;
  private normals: Float32Array;
  private indices: Uint32Array;
  private vertices = 0;
  private corners = 0;

  constructor(expectedVertices: number) {
    const v = Math.max(expectedVertices, 16);
    this.positions = new Float32Array(v * 3);
    this.normals = new Float32Array(v * 3);
    this.indices = new Uint32Array(v * 6);
  }

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    if ((this.vertices + 1) * 3 > this.positions.length) {
      this.positions = grow(this.positions);
      this.normals = grow(this.normals);
    }
    const length = Math.hypot(nx, ny, nz) || 1;
    const k = this.vertices * 3;
    this.positions[k] = x;
    this.positions[k + 1] = y;
    this.positions[k + 2] = z;
    this.normals[k] = nx / length;
    this.normals[k + 1] = ny / length;
    this.normals[k + 2] = nz / length;
    return this.vertices++;
  }

  triangle(a: number, b: number, c: number) {
    if (this.corners + 3 > this.indices.length) this.indices = grow(this.indices);
    this.indices[this.corners++] = a;
    this.indices[this.corners++] = b;
    this.indices[this.corners++] = c;
  }

  build(): MeshData {
    return {
      positions: this.positions.slice(0, this.vertices * 3),
      normals: this.normals.slice(0, this.vertices * 3),
      indices: this.indices.slice(0, this.corners),
    };
  }
}

function grow<T extends Float32Array | Uint32Array>(array: T): T {
  const bigger = new (array.constructor as new (n: number) => T)(array.length * 2);
  bigger.set(array);
  return bigger;
}

/**
 * Builds the visible surfaces of the cut stock: the board, and each loose
 * piece on its own. A grid square is drawn when any of its corners still has
 * material of that piece; corners that are cut through sit where the top and
 * bottom surfaces meet, so cut walls and holes close up without gaps.
 */
export function buildStockMeshes(field: HeightField, parts: PartMap): StockMeshes {
  const surfaces = surfacesOf(field);
  const looseLabels = new Set(parts.loose.map((p) => p.label));
  const isBoard = (label: number) => label !== 0 && !looseLabels.has(label);
  const all: Span = { minCol: 0, maxCol: field.cols - 1, minRow: 0, maxRow: field.rows - 1 };

  // Top and bottom of every cell, plus the walls.
  const board = new MeshBuilder(2 * field.cols * field.rows + 4 * (field.cols + field.rows));
  surface(surfaces, parts.labels, isBoard, all, board);
  outerWalls(surfaces, board);

  return {
    board: board.build(),
    loose: parts.loose.map((part) => {
      // One cell of margin takes in the cut-through ring around the piece.
      const span = {
        minCol: Math.max(0, part.minCol - 1),
        maxCol: Math.min(field.cols - 1, part.maxCol + 1),
        minRow: Math.max(0, part.minRow - 1),
        maxRow: Math.min(field.rows - 1, part.maxRow + 1),
      };
      const area = (span.maxCol - span.minCol + 1) * (span.maxRow - span.minRow + 1);
      const mesh = new MeshBuilder(2 * area);
      surface(surfaces, parts.labels, (label) => label === part.label, span, mesh);
      return { part, mesh: mesh.build() };
    }),
  };
}

/** Top and bottom surfaces of the cells that pass `belongs`, within `span`. */
function surface(
  { field, solid, z }: Surfaces,
  labels: Int32Array,
  belongs: (label: number) => boolean,
  span: Span,
  out: MeshBuilder,
) {
  const { cols, rows, cell } = field;
  const width = span.maxCol - span.minCol + 1;
  const height = span.maxRow - span.minRow + 1;
  const cache = [new Int32Array(width * height).fill(-1), new Int32Array(width * height).fill(-1)];

  const vertex = (col: number, row: number, side: 0 | 1): number => {
    const local = (row - span.minRow) * width + (col - span.minCol);
    const known = cache[side]![local]!;
    if (known >= 0) return known;
    // Slope from neighbours within the span; world Y runs opposite to rows.
    const h = z[side];
    const left = row * cols + Math.max(col - 1, span.minCol);
    const right = row * cols + Math.min(col + 1, span.maxCol);
    const up = Math.max(row - 1, span.minRow) * cols + col;
    const down = Math.min(row + 1, span.maxRow) * cols + col;
    const dzdx = (h[right]! - h[left]!) / (2 * cell);
    const dzdy = (h[up]! - h[down]!) / (2 * cell);
    const sign = side === 0 ? 1 : -1;
    const index = out.vertex(
      (col + 0.5) * cell,
      (rows - row - 0.5) * cell,
      h[row * cols + col]!,
      -sign * dzdx,
      -sign * dzdy,
      sign,
    );
    cache[side]![local] = index;
    return index;
  };

  /** 1 if the corner has this piece's material, 0 if cut through, −1 if another piece's. */
  const owner = (i: number) => (solid[i] ? (belongs(labels[i]!) ? 1 : -1) : 0);

  for (let row = span.minRow; row < span.maxRow; row++) {
    for (let col = span.minCol; col < span.maxCol; col++) {
      const i = row * cols + col;
      const a0 = owner(i);
      const b0 = owner(i + 1);
      const c0 = owner(i + cols);
      const d0 = owner(i + cols + 1);
      // Skip squares that are all cut away or that touch another piece.
      if (a0 + b0 + c0 + d0 === 0 || a0 < 0 || b0 < 0 || c0 < 0 || d0 < 0) continue;
      // Counter-clockwise seen from outside: from above for the top, from below for the bottom.
      let a = vertex(col, row, 0);
      let b = vertex(col + 1, row, 0);
      let c = vertex(col, row + 1, 0);
      let d = vertex(col + 1, row + 1, 0);
      out.triangle(a, c, b);
      out.triangle(b, c, d);
      a = vertex(col, row, 1);
      b = vertex(col + 1, row, 1);
      c = vertex(col, row + 1, 1);
      d = vertex(col + 1, row + 1, 1);
      out.triangle(a, b, c);
      out.triangle(b, d, c);
    }
  }
}

/** The stock's four outer sides, from the bottom surface up to the top. */
function outerWalls({ field, solid, z }: Surfaces, out: MeshBuilder) {
  const { cols, rows, cell } = field;
  const [top, bottom] = z;
  /** One side: `count` cells from (col, row), stepping by (dc, dr), facing (nx, ny). */
  const side = (
    col: number,
    row: number,
    dc: number,
    dr: number,
    count: number,
    nx: number,
    ny: number,
    flip: boolean,
  ) => {
    for (let k = 0; k + 1 < count; k++) {
      const c0 = col + dc * k;
      const r0 = row + dr * k;
      const i0 = r0 * cols + c0;
      const i1 = (r0 + dr) * cols + (c0 + dc);
      if (!solid[i0] && !solid[i1]) continue;
      const p = (c: number, r: number, h: number) =>
        out.vertex((c + 0.5) * cell, (rows - r - 0.5) * cell, h, nx, ny, 0);
      const a = p(c0, r0, bottom[i0]!);
      const b = p(c0 + dc, r0 + dr, bottom[i1]!);
      const c = p(c0, r0, top[i0]!);
      const d = p(c0 + dc, r0 + dr, top[i1]!);
      if (flip) {
        out.triangle(a, c, b);
        out.triangle(b, c, d);
      } else {
        out.triangle(a, b, c);
        out.triangle(b, d, c);
      }
    }
  };
  side(0, rows - 1, 1, 0, cols, 0, -1, false); // front (machine Y = 0)
  side(0, 0, 1, 0, cols, 0, 1, true); // back
  side(0, 0, 0, 1, rows, -1, 0, false); // left
  side(cols - 1, 0, 0, 1, rows, 1, 0, true); // right
}
