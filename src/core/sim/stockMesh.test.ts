import { createHeightField, type HeightField } from './heightField';
import { findParts } from './looseParts';
import { buildStockMeshes, type MeshData } from './stockMesh';

const stock = { width: 5, height: 5, thickness: 6 };
/** A 10 × 10 grid of 0.5 mm cells (the largest cell size allowed). */
const field = () => createHeightField(stock, 100);

const zs = (m: MeshData) => Array.from(m.positions).filter((_, i) => i % 3 === 2);
const triangles = (m: MeshData) => m.indices.length / 3;

/** Cuts the square of cells [c0, c1] × [r0, r1] right through. */
function cutThrough(f: HeightField, c0: number, c1: number, r0: number, r1: number) {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f.top[r * f.cols + c] = -6;
}

describe('buildStockMeshes', () => {
  it('draws uncut stock as a closed box with flat faces', () => {
    const f = field();
    const { board, loose } = buildStockMeshes(f, findParts(f));
    expect(loose).toEqual([]);
    // 9 × 9 squares, top and bottom, 2 triangles each; 4 walls of 9 squares, 2 triangles each.
    expect(triangles(board)).toBe(9 * 9 * 2 * 2 + 4 * 9 * 2);
    expect(new Set(zs(board))).toEqual(new Set([0, -6]));
    // Top vertices face straight up, apart from the walls' top edges, which face out.
    for (let v = 0; v < board.positions.length / 3; v++) {
      if (board.positions[v * 3 + 2] !== 0) continue;
      const [nx, ny, nz] = [0, 1, 2].map((k) => board.normals[v * 3 + k]!);
      expect(nz === 1 || (nz === 0 && Math.abs(nx!) + Math.abs(ny!) === 1)).toBe(true);
    }
  });

  it('leaves a gap where the stock is cut through and lifts nothing that is still held', () => {
    const f = field();
    cutThrough(f, 3, 6, 3, 6);
    const { board, loose } = buildStockMeshes(f, findParts(f));
    expect(loose).toEqual([]);
    // The 3 × 3 squares fully inside the hole are gone from top and bottom.
    expect(triangles(board)).toBe((9 * 9 - 3 * 3) * 2 * 2 + 4 * 9 * 2);
  });

  it('gives a piece cut free its own mesh', () => {
    const f = field();
    // A ring of cuts around the middle 2 × 2 cells.
    cutThrough(f, 2, 7, 2, 7);
    for (let r = 4; r <= 5; r++) for (let c = 4; c <= 5; c++) f.top[r * f.cols + c] = 0;
    const { loose } = buildStockMeshes(f, findParts(f));
    expect(loose).toHaveLength(1);
    expect(loose[0]!.part).toMatchObject({ minCol: 4, maxCol: 5, cells: 4 });
    expect(Math.max(...zs(loose[0]!.mesh))).toBe(0);
  });
});
