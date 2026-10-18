import { boundsOfPaths, isEmptyBounds, scalePaths, type Path } from '../geometry/path';
import type { DesignObject, Stock } from './job';
import { createObject } from './objectFactory';

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

/** A traced image scaled so its artwork is `widthMm` wide, cropped and centred. */
export function createTracedObject(input: TracedObjectInput): DesignObject {
  const mmPerPixel = input.widthMm / artworkSize(input.paths).width;
  return createObject({
    id: input.id,
    name: input.name,
    kind: 'traced-image',
    paths: scalePaths(input.paths, mmPerPixel),
    stock: input.stock,
  });
}

/** A starting width that fits comfortably on the stock, keeping the artwork's aspect. */
export function suggestedWidth(width: number, height: number, stock: Stock): number {
  if (width <= 0 || height <= 0) return 0;
  const fit = Math.min((stock.width * 0.8) / width, (stock.height * 0.8) / height);
  return Math.round(width * fit);
}
