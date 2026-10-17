import { boundsOfPaths, signedArea } from '../geometry/path';
import { otsuThreshold, rgbaToGray, type GrayBitmap } from './grayBitmap';
import { DEFAULT_TRACE_OPTIONS, traceImage, type TraceOptions } from './traceImage';

/** Builds a bitmap from rows of characters: '#' is black, anything else white. */
function bitmapFrom(rows: string[]): GrayBitmap {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * height);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => (data[y * width + x] = ch === '#' ? 0 : 255)),
  );
  return { width, height, data };
}

const sharp: TraceOptions = { ...DEFAULT_TRACE_OPTIONS, smoothing: 0, despeckle: 0 };

describe('rgbaToGray', () => {
  it('treats transparent pixels as white', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
    expect([...rgbaToGray(rgba, 2, 1).data]).toEqual([0, 255]);
  });
});

describe('otsuThreshold', () => {
  it('splits a clean black-and-white image right between the tones', () => {
    expect(otsuThreshold(bitmapFrom(['##..', '##..']))).toBe(128);
  });

  it('separates two gray levels', () => {
    const data = new Uint8ClampedArray([40, 40, 40, 200, 200, 200]);
    const t = otsuThreshold({ width: 6, height: 1, data });
    expect(t).toBeGreaterThan(40);
    expect(t).toBeLessThanOrEqual(200);
  });
});

describe('traceImage', () => {
  it('outlines a black square', () => {
    const { paths } = traceImage(
      bitmapFrom(['......', '.####.', '.####.', '.####.', '.####.', '......']),
      sharp,
    );
    expect(paths).toHaveLength(1);
    const b = boundsOfPaths(paths);
    // The edge sits halfway between the ink and paper pixel centres: on the pixel boundary.
    expect(b).toEqual({ minX: 1, minY: 1, maxX: 5, maxY: 5 });
    expect(Math.abs(signedArea(paths[0]!.points))).toBeCloseTo(15.5); // 4×4 minus a 0.125 px² triangle at each corner
  });

  it('finds holes as separate loops', () => {
    const ring = ['.......', '.#####.', '.#...#.', '.#...#.', '.#...#.', '.#####.', '.......'];
    const { paths } = traceImage(bitmapFrom(ring), sharp);
    expect(paths).toHaveLength(2);
  });

  it('closes shapes that touch the image border along the edge', () => {
    const { paths } = traceImage(bitmapFrom(['###', '###', '###']), sharp);
    expect(paths).toHaveLength(1);
    expect(boundsOfPaths(paths)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 3 });
  });

  it('inverts: light shapes on a dark background', () => {
    const { paths } = traceImage(bitmapFrom(['#####', '#...#', '#...#', '#...#', '#####']), {
      ...sharp,
      invert: true,
    });
    expect(paths).toHaveLength(1);
    expect(boundsOfPaths(paths)).toEqual({ minX: 1, minY: 1, maxX: 4, maxY: 4 });
  });

  it('despeckle drops tiny blobs', () => {
    const rows = [
      '..........',
      '.#........',
      '..........',
      '....####..',
      '....####..',
      '....####..',
      '....####..',
    ];
    expect(traceImage(bitmapFrom(rows), sharp).paths).toHaveLength(2);
    expect(traceImage(bitmapFrom(rows), { ...sharp, despeckle: 4 }).paths).toHaveLength(1);
  });

  it('keeps diagonal touching pixels separate', () => {
    const { paths } = traceImage(bitmapFrom(['....', '.#..', '..#.', '....']), sharp);
    expect(paths).toHaveLength(2);
  });

  it('returns nothing for a blank image', () => {
    expect(traceImage(bitmapFrom(['....', '....']), sharp).paths).toEqual([]);
  });
});
