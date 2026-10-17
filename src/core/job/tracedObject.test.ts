import { boundsOfPaths } from '../geometry/path';
import { artworkSize, createTracedObject, suggestedWidth } from './tracedObject';

const stock = { width: 200, height: 100, thickness: 6 };

// Artwork occupies pixels 100..500 × 50..250 of some larger image.
const paths = [
  {
    closed: true,
    points: [
      { x: 100, y: 50 },
      { x: 500, y: 50 },
      { x: 500, y: 250 },
    ],
  },
];

describe('createTracedObject', () => {
  it('crops to the artwork, scales to mm and centres it on the stock', () => {
    const object = createTracedObject({ id: 'x', name: 'owl', paths, widthMm: 80, stock });
    expect(object.width).toBe(80);
    expect(object.height).toBe(40);
    expect(boundsOfPaths(object.paths)).toEqual({ minX: 0, minY: 0, maxX: 80, maxY: 40 });
    expect(object.transform).toMatchObject({ x: 60, y: 30 });
    expect(object.operation).toMatchObject({ type: 'engrave', bitId: 'vbit-60' });
  });
});

describe('artworkSize', () => {
  it('measures the outlines, not the image', () => {
    expect(artworkSize(paths)).toEqual({ width: 400, height: 200 });
    expect(artworkSize([])).toEqual({ width: 0, height: 0 });
  });
});

describe('suggestedWidth', () => {
  it('fits 80% of the stock in the limiting direction', () => {
    expect(suggestedWidth(400, 200, stock)).toBe(160); // limited by width
    expect(suggestedWidth(100, 400, stock)).toBe(20); // limited by height: 80 mm tall
    expect(suggestedWidth(0, 0, stock)).toBe(0);
  });
});
