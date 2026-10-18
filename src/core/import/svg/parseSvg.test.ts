import { boundsOfPaths, distance, pathLength } from '../../geometry/path';
import { parseSvg } from './parseSvg';
import { parsePathData } from './svgPathData';
import { parseTransform } from './svgTransform';
import { lengthToMm, rootMatrix } from './svgUnits';

const svg = (attrs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

describe('units', () => {
  it('converts lengths to mm', () => {
    expect(lengthToMm('100mm')).toBe(100);
    expect(lengthToMm('2in')).toBeCloseTo(50.8);
    expect(lengthToMm('96')).toBeCloseTo(25.4); // px
    expect(lengthToMm('100%')).toBeNull();
  });

  it('maps the viewBox onto the physical size', () => {
    const m = rootMatrix({
      width: '200mm',
      height: '100mm',
      viewBox: '0 0 20 10',
      preserveAspectRatio: null,
    });
    expect([m.a, m.d, m.e, m.f]).toEqual([10, 10, 0, 0]);
  });

  it('centres with uniform scale when aspect ratios differ', () => {
    const m = rootMatrix({
      width: '100mm',
      height: '100mm',
      viewBox: '0 0 50 25',
      preserveAspectRatio: null,
    });
    expect([m.a, m.d, m.e, m.f]).toEqual([2, 2, 0, 25]);
  });

  it('defaults to 96 DPI user units', () => {
    expect(
      rootMatrix({ width: null, height: null, viewBox: null, preserveAspectRatio: null }).a,
    ).toBeCloseTo(25.4 / 96);
  });
});

describe('parseTransform', () => {
  it('composes left to right like SVG', () => {
    const m = parseTransform('translate(10, 0) scale(2)');
    expect([m.a, m.d, m.e]).toEqual([2, 2, 10]);
  });

  it('rotates about a point', () => {
    const m = parseTransform('rotate(90 5 5)');
    // (10, 5) rotated 90° clockwise (Y down) about (5, 5) → (5, 10)
    expect(10 * m.a + 5 * m.c + m.e).toBeCloseTo(5);
    expect(10 * m.b + 5 * m.d + m.f).toBeCloseTo(10);
  });
});

describe('parsePathData', () => {
  it('handles relative commands, implicit line-tos and closing', () => {
    const [sub] = parsePathData('m10 10 20 0 0 20 h-20 z');
    expect(sub!.closed).toBe(true);
    expect(sub!.segments.map((s) => s.to)).toEqual([
      { x: 30, y: 10 },
      { x: 30, y: 30 },
      { x: 10, y: 30 },
    ]);
  });

  it('reads packed numbers and arc flags', () => {
    const subs = parsePathData('M0,0L.5.5a5 5 0 105 5');
    expect(subs[0]!.segments[0]!.to).toEqual({ x: 0.5, y: 0.5 });
    expect(subs[0]!.segments.at(-1)!.to).toEqual({ x: 5.5, y: 5.5 });
  });

  it('stops at garbage instead of looping', () => {
    expect(parsePathData('M0 0 L10 0 Z 5 5')).toHaveLength(1);
    expect(parsePathData('nonsense')).toEqual([]);
  });
});

describe('parseSvg', () => {
  it('reads a 50 mm square in mm units', () => {
    const { paths } = parseSvg(
      svg(
        'width="100mm" height="100mm" viewBox="0 0 100 100"',
        '<rect x="10" y="10" width="50" height="50"/>',
      ),
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]!.closed).toBe(true);
    expect(boundsOfPaths(paths)).toEqual({ minX: 10, minY: 10, maxX: 60, maxY: 60 });
  });

  it('flattens circles within tolerance', () => {
    const { paths } = parseSvg(
      svg('width="100mm" height="100mm" viewBox="0 0 100 100"', '<circle cx="50" cy="50" r="20"/>'),
    );
    const circle = paths[0]!;
    for (const p of circle.points) expect(distance(p, { x: 50, y: 50 })).toBeCloseTo(20, 1);
    expect(pathLength(circle)).toBeCloseTo(2 * Math.PI * 20, 0);
  });

  it('draws arcs the right way round', () => {
    // Half circle from (0,10) to (20,10) bulging up (sweep=1 is clockwise on screen).
    const { paths } = parseSvg(
      svg(
        'width="100mm" height="100mm" viewBox="0 0 100 100"',
        '<path d="M0 10 A10 10 0 0 1 20 10"/>',
      ),
    );
    const b = boundsOfPaths(paths);
    expect(b.minY).toBeCloseTo(0, 2);
    expect(b.maxY).toBeCloseTo(10, 5);
  });

  it('applies nested group transforms', () => {
    const { paths } = parseSvg(
      svg(
        'width="100mm" height="100mm" viewBox="0 0 100 100"',
        '<g transform="translate(20 0)"><g transform="scale(2)"><line x1="0" y1="0" x2="10" y2="0"/></g></g>',
      ),
    );
    expect(boundsOfPaths(paths)).toEqual({ minX: 20, minY: 0, maxX: 40, maxY: 0 });
  });

  it('joins separate segments into a closed loop', () => {
    const { paths } = parseSvg(
      svg(
        'width="10mm" height="10mm" viewBox="0 0 10 10"',
        '<line x1="0" y1="0" x2="10" y2="0"/><line x1="10" y1="10" x2="10" y2="0"/><polyline points="10,10 0,10 0,0"/>',
      ),
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]!.closed).toBe(true);
    expect(paths[0]!.points).toHaveLength(4);
  });

  it('skips definitions and hidden elements, and reports unsupported ones', () => {
    const { paths, warnings } = parseSvg(
      svg(
        '',
        '<defs><rect width="5" height="5"/></defs><rect width="5" height="5" display="none"/><text>Hi</text><text>Yo</text><image href="x.png"/>',
      ),
    );
    expect(paths).toEqual([]);
    expect(warnings).toEqual([
      expect.stringContaining('2 × text'),
      expect.stringContaining('embedded images'),
    ]);
  });

  it('rejects files that are not SVG', () => {
    expect(() => parseSvg('<html></html>')).toThrow('Not a valid SVG');
  });
});
