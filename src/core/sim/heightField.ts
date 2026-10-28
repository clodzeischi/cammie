import type { Stock } from '../job/job';

/**
 * The stock after cutting, as two height maps over a grid seen from the top
 * (SPEC.md §10.1). Heights are machine Z: 0 is the top of the stock and
 * −thickness its bottom. A cell is solid where `top > bottom`; once the two
 * meet it's been cut through. Cell (col, row) is centred at
 * ((col + ½)·cell, (row + ½)·cell) in canvas millimetres (stock top-left = 0, 0).
 */
export interface HeightField {
  cols: number;
  rows: number;
  /** Cell size (mm). */
  cell: number;
  thickness: number;
  /** Top surface: 0 where uncut, lower where top cuts went. */
  top: Float32Array;
  /** Bottom surface: −thickness where uncut, higher where bottom cuts went. */
  bottom: Float32Array;
  /** How far cuts went past the stock into the spoilboard (mm, 0 = not at all). */
  spoil: Float32Array;
}

/** About 6 MB per map: sharp enough to see V-grooves on a 3018-sized stock, quick to carve. */
export const DEFAULT_MAX_CELLS = 1_500_000;
/** Finer than this shows nothing new on screen; coarser than this blurs a 1 mm bit's slot. */
const MIN_CELL = 0.05;
const MAX_CELL = 0.5;

/** The cell size that fits the stock into `maxCells`, within sensible limits. */
export function cellSize(stock: Stock, maxCells: number = DEFAULT_MAX_CELLS): number {
  const fit = Math.sqrt((stock.width * stock.height) / maxCells);
  return Math.min(Math.max(fit, MIN_CELL), MAX_CELL);
}

/** Uncut stock. */
export function createHeightField(stock: Stock, maxCells?: number): HeightField {
  const cell = cellSize(stock, maxCells);
  const cols = Math.max(1, Math.ceil(stock.width / cell - 1e-9));
  const rows = Math.max(1, Math.ceil(stock.height / cell - 1e-9));
  const size = cols * rows;
  return {
    cols,
    rows,
    cell,
    thickness: stock.thickness,
    top: new Float32Array(size),
    bottom: new Float32Array(size).fill(-stock.thickness),
    spoil: new Float32Array(size),
  };
}

/** Thinner than this (mm) counts as cut through: float noise, not material. */
export const SOLID_EPSILON = 0.01;

export const isSolid = (field: HeightField, index: number): boolean =>
  field.top[index]! - field.bottom[index]! > SOLID_EPSILON;
