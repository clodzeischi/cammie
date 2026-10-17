import { signedArea, type Path } from '../geometry/path';
import { simplifyPath } from '../geometry/simplify';
import { blur, type GrayBitmap } from './grayBitmap';
import { traceContours } from './marchingSquares';

export interface TraceOptions {
  /** 0–255. Pixels darker than this are ink (or lighter, when inverted). */
  threshold: number;
  invert: boolean;
  /** Blur radius in pixels before tracing; higher = smoother, rounder outlines. */
  smoothing: number;
  /** Outlines enclosing less than this many square pixels are dropped. */
  despeckle: number;
  /** Max deviation (pixels) allowed when simplifying outlines. */
  simplifyTolerance: number;
}

export const DEFAULT_TRACE_OPTIONS: TraceOptions = {
  threshold: 128,
  invert: false,
  smoothing: 1,
  despeckle: 16,
  simplifyTolerance: 0.35,
};

export interface TraceResult {
  /** Closed outlines in pixel units. */
  paths: Path[];
  pointCount: number;
}

/** Bitmap → closed vector outlines (in pixels). Pure; runs in the trace worker. */
export function traceImage(bitmap: GrayBitmap, options: TraceOptions): TraceResult {
  const values = blur(bitmap, options.smoothing);

  // Turn brightness into "ink amount" so the tracer always looks for values above a level.
  const field = new Float32Array(values.length);
  let level: number;
  if (options.invert) {
    field.set(values);
    level = options.threshold - 0.5;
  } else {
    for (let i = 0; i < values.length; i++) field[i] = 255 - values[i]!;
    level = 255 - options.threshold + 0.5;
  }

  const paths = traceContours(field, bitmap.width, bitmap.height, level)
    .filter((path) => Math.abs(signedArea(path.points)) >= options.despeckle)
    .map((path) => simplifyPath(path, options.simplifyTolerance));

  const pointCount = paths.reduce((n, p) => n + p.points.length, 0);
  return { paths, pointCount };
}
