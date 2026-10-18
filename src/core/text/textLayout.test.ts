import { readFileSync } from 'node:fs';
import { parse } from 'opentype.js';
import { boundsOfPaths, signedArea } from '../geometry/path';
import type { TextShape } from '../job/job';
import { FONTS } from './fonts';
import { layoutText, type FontLike } from './textLayout';

const loadFont = (id: string): FontLike => {
  const file = readFileSync(`node_modules/@fontsource/${id}/files/${id}-latin-400-normal.woff`);
  return parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
};

const text = (changes: Partial<TextShape> = {}): TextShape => ({
  type: 'text',
  text: 'H',
  fontId: 'roboto',
  capHeight: 20,
  letterSpacing: 0,
  lineSpacing: 1,
  align: 'left',
  ...changes,
});

describe('layoutText', () => {
  const roboto = loadFont('roboto');

  it('sizes letters by cap height, sitting on the baseline (Y down)', () => {
    const b = boundsOfPaths(layoutText(roboto, text()).paths);
    expect(b.maxY).toBeCloseTo(0, 1);
    expect(b.minY).toBeCloseTo(-20, 1);
  });

  it('keeps the holes in letters', () => {
    const { paths } = layoutText(roboto, text({ text: 'O' }));
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => Math.sign(signedArea(p.points))).sort()).toEqual([-1, 1]);
  });

  it('adds letter spacing between letters only', () => {
    const tight = boundsOfPaths(layoutText(roboto, text({ text: 'HHH' })).paths);
    const loose = boundsOfPaths(layoutText(roboto, text({ text: 'HHH', letterSpacing: 5 })).paths);
    expect(loose.maxX - loose.minX - (tight.maxX - tight.minX)).toBeCloseTo(10, 5);
  });

  it('stacks lines and aligns them', () => {
    const shape = text({ text: 'HHHH\nH', align: 'right' });
    const { paths } = layoutText(roboto, shape);
    const lines = [
      paths.filter((p) => p.points[0]!.y < 1),
      paths.filter((p) => p.points[0]!.y > 1),
    ];
    expect(lines.map((l) => l.length)).toEqual([4, 1]);
    const right = lines.map((l) => boundsOfPaths(l).maxX);
    expect(right[0]).toBeCloseTo(right[1]!, 5);
    const doubled = layoutText(roboto, { ...shape, lineSpacing: 2 });
    const gap = (r: typeof paths) => boundsOfPaths(r).maxY;
    expect(gap(doubled.paths)).toBeCloseTo(2 * gap(paths), 5);
  });

  it('merges overlapping script letters into one outline', () => {
    const vibes = loadFont('great-vibes');
    const { paths } = layoutText(vibes, text({ text: 'mm', fontId: 'great-vibes' }));
    // Each joined "m" would be one outline; overlapping, they become a single one.
    expect(paths.filter((p) => signedArea(p.points) > 0)).toHaveLength(1);
  });

  it('reports characters the font lacks and leaves them out', () => {
    const { paths, missing } = layoutText(roboto, text({ text: 'H✓' }));
    expect(missing).toEqual(['✓']);
    expect(paths).toHaveLength(1);
  });

  it('every bundled font lays out text', () => {
    for (const font of FONTS) {
      const { paths } = layoutText(
        loadFont(font.id),
        text({ text: 'Cammie 3018', fontId: font.id }),
      );
      const b = boundsOfPaths(paths);
      expect(paths.length, font.id).toBeGreaterThan(5);
      expect(b.maxY - b.minY, font.id).toBeGreaterThan(15);
    }
  });
});
