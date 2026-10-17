import { boundsOfPaths, isEmptyBounds, type Path } from '../geometry/path';
import { DEFAULT_VBIT_ID } from '../tools/bits';
import type { DesignObject, Stock } from './job';

/** New engravings start shallow: a fine line that's easy to deepen. */
export const DEFAULT_ENGRAVE_DEPTH = 0.5;

/** Size of the traced artwork itself (not the image), in pixels. */
export function artworkSize(paths: readonly Path[]): { width: number; height: number } {
  const b = boundsOfPaths(paths);
  return isEmptyBounds(b)
    ? { width: 0, height: 0 }
    : { width: b.maxX - b.minX, height: b.maxY - b.minY };
}

export interface TracedObjectInput {
  id: string;
  name: string;
  /** Outlines in pixel units. */
  paths: Path[];
  /** Physical width of the artwork (the outlines' bounding box). */
  widthMm: number;
  stock: Stock;
}

/**
 * A traced image cropped to its artwork, scaled to size, centred on the stock
 * and set to V-bit engrave. Cropping means X/Y and size refer to the actual
 * lines, not the image's empty margins.
 */
export function createTracedObject(input: TracedObjectInput): DesignObject {
  const b = boundsOfPaths(input.paths);
  const mmPerPixel = input.widthMm / (b.maxX - b.minX);
  const paths = input.paths.map((path) => ({
    closed: path.closed,
    points: path.points.map((p) => ({
      x: (p.x - b.minX) * mmPerPixel,
      y: (p.y - b.minY) * mmPerPixel,
    })),
  }));
  const width = input.widthMm;
  const height = (b.maxY - b.minY) * mmPerPixel;
  return {
    id: input.id,
    name: input.name,
    kind: 'traced-image',
    paths,
    width,
    height,
    transform: {
      x: (input.stock.width - width) / 2,
      y: (input.stock.height - height) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    operation: {
      type: 'engrave',
      bitId: DEFAULT_VBIT_ID,
      depth: DEFAULT_ENGRAVE_DEPTH,
      overrides: {},
    },
  };
}

/** A starting width that fits comfortably on the stock, keeping the artwork's aspect. */
export function suggestedWidth(width: number, height: number, stock: Stock): number {
  if (width <= 0 || height <= 0) return 0;
  const fit = Math.min((stock.width * 0.8) / width, (stock.height * 0.8) / height);
  return Math.round(width * fit);
}
