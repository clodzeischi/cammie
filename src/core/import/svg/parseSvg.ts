import { flattenCubic } from '../../geometry/bezier';
import { joinOpenPaths, tidyPath } from '../../geometry/cleanPaths';
import type { Path } from '../../geometry/path';
import { applyMatrix, type Matrix } from '../../geometry/transform';
import { parsePathData, type SubPath } from './svgPathData';
import { shapeSubpaths } from './svgShapes';
import { multiply, parseTransform } from './svgTransform';
import { rootMatrix } from './svgUnits';

/** Max distance (mm) between a curve and the line segments replacing it. */
const CURVE_TOLERANCE = 0.01;

/** Never drawn: definitions, styling and metadata. */
const SKIPPED = new Set([
  'defs',
  'clipPath',
  'mask',
  'symbol',
  'marker',
  'pattern',
  'linearGradient',
  'radialGradient',
  'filter',
  'style',
  'script',
  'title',
  'desc',
  'metadata',
  'foreignObject',
]);

/** Drawn, but not something Cammie can cut; the user gets told. */
const UNSUPPORTED: Record<string, string> = {
  text: 'text (convert text to paths in your design app)',
  image: 'embedded images (import those as images instead)',
  use: 'linked copies (<use>; unlink or expand them in your design app)',
};

export interface SvgImport {
  /** Outlines in mm, Y pointing down. */
  paths: Path[];
  warnings: string[];
}

const hidden = (el: Element) =>
  el.getAttribute('display') === 'none' ||
  /display\s*:\s*none/.test(el.getAttribute('style') ?? '');

/** Subpath (user units) → polyline (mm), flattening curves after transforming them. */
function flatten(sub: SubPath, m: Matrix): Path | null {
  let pos = applyMatrix(m, sub.start);
  const points = [pos];
  for (const seg of sub.segments) {
    const to = applyMatrix(m, seg.to);
    if (seg.kind === 'line') {
      points.push(to);
    } else {
      const [c1, c2] = [applyMatrix(m, seg.c1), applyMatrix(m, seg.c2)];
      points.push(...flattenCubic(pos, c1, c2, to, CURVE_TOLERANCE));
    }
    pos = to;
  }
  return tidyPath({ closed: sub.closed, points });
}

/**
 * Reads an SVG document into cuttable outlines (SPEC.md §5.1). Geometry only:
 * fills and strokes are ignored and every stroke is treated as a centre line.
 */
export function parseSvg(text: string): SvgImport {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Not a valid SVG file.');
  }

  const paths: Path[] = [];
  const unsupported = new Map<string, number>();

  const visit = (el: Element, parent: Matrix) => {
    const tag = el.localName;
    if (SKIPPED.has(tag) || hidden(el)) return;
    if (UNSUPPORTED[tag]) {
      unsupported.set(tag, (unsupported.get(tag) ?? 0) + 1);
      return;
    }
    const m = multiply(parent, parseTransform(el.getAttribute('transform')));
    const attr = (name: string) => el.getAttribute(name);
    const subpaths = tag === 'path' ? parsePathData(attr('d') ?? '') : shapeSubpaths(tag, attr);
    if (subpaths) {
      for (const sub of subpaths) {
        const path = flatten(sub, m);
        if (path) paths.push(path);
      }
      return;
    }
    // Containers (svg, g, a, switch…): walk the children.
    for (const child of el.children) visit(child, m);
  };

  const base = rootMatrix({
    width: root.getAttribute('width'),
    height: root.getAttribute('height'),
    viewBox: root.getAttribute('viewBox'),
    preserveAspectRatio: root.getAttribute('preserveAspectRatio'),
  });
  for (const child of root.children) visit(child, base);

  const warnings = [...unsupported].map(
    ([tag, count]) => `Skipped ${count} × ${UNSUPPORTED[tag]}.`,
  );
  return { paths: joinOpenPaths(paths), warnings };
}
