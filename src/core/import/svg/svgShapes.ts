import type { Vec2 } from '../../geometry/path';
import type { Segment, SubPath } from './svgPathData';
import { numberAttr } from './svgUnits';

/** Control-point distance for a quarter ellipse drawn with one cubic. */
const KAPPA = 0.5522847498;

type Attr = (name: string) => string | null;

/** Quarter-ellipse cubic from `from` to `to`, bulging away from the corner `corner`. */
function quarter(from: Vec2, to: Vec2, corner: Vec2): Segment {
  return {
    kind: 'cubic',
    c1: { x: from.x + (corner.x - from.x) * KAPPA, y: from.y + (corner.y - from.y) * KAPPA },
    c2: { x: to.x + (corner.x - to.x) * KAPPA, y: to.y + (corner.y - to.y) * KAPPA },
    to,
  };
}

function ellipse(cx: number, cy: number, rx: number, ry: number): SubPath[] {
  if (rx <= 0 || ry <= 0) return [];
  const right = { x: cx + rx, y: cy };
  const bottom = { x: cx, y: cy + ry };
  const left = { x: cx - rx, y: cy };
  const top = { x: cx, y: cy - ry };
  return [
    {
      start: right,
      closed: true,
      segments: [
        quarter(right, bottom, { x: cx + rx, y: cy + ry }),
        quarter(bottom, left, { x: cx - rx, y: cy + ry }),
        quarter(left, top, { x: cx - rx, y: cy - ry }),
        quarter(top, right, { x: cx + rx, y: cy - ry }),
      ],
    },
  ];
}

function rect(a: Attr): SubPath[] {
  const x = numberAttr(a('x'));
  const y = numberAttr(a('y'));
  const w = numberAttr(a('width'));
  const h = numberAttr(a('height'));
  if (w <= 0 || h <= 0) return [];
  // Missing radius copies the other one; both are capped at half the side.
  const rxRaw = a('rx') !== null ? numberAttr(a('rx')) : numberAttr(a('ry'));
  const ryRaw = a('ry') !== null ? numberAttr(a('ry')) : rxRaw;
  const rx = Math.min(Math.max(rxRaw, 0), w / 2);
  const ry = Math.min(Math.max(ryRaw, 0), h / 2);
  const line = (px: number, py: number): Segment => ({ kind: 'line', to: { x: px, y: py } });

  if (rx === 0 || ry === 0) {
    return [
      {
        start: { x, y },
        closed: true,
        segments: [line(x + w, y), line(x + w, y + h), line(x, y + h)],
      },
    ];
  }
  const p = (px: number, py: number) => ({ x: px, y: py });
  return [
    {
      start: p(x + rx, y),
      closed: true,
      segments: [
        line(x + w - rx, y),
        quarter(p(x + w - rx, y), p(x + w, y + ry), p(x + w, y)),
        line(x + w, y + h - ry),
        quarter(p(x + w, y + h - ry), p(x + w - rx, y + h), p(x + w, y + h)),
        line(x + rx, y + h),
        quarter(p(x + rx, y + h), p(x, y + h - ry), p(x, y + h)),
        line(x, y + ry),
        quarter(p(x, y + ry), p(x + rx, y), p(x, y)),
      ],
    },
  ];
}

function points(list: string | null, closed: boolean): SubPath[] {
  const n = (list ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const pts: Vec2[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) {
    if (!Number.isFinite(n[i]) || !Number.isFinite(n[i + 1])) break;
    pts.push({ x: n[i]!, y: n[i + 1]! });
  }
  if (pts.length < 2) return [];
  return [
    { start: pts[0]!, closed, segments: pts.slice(1).map((to) => ({ kind: 'line' as const, to })) },
  ];
}

/** Basic SVG shapes as subpaths in user units; null if `tag` isn't a basic shape. */
export function shapeSubpaths(tag: string, a: Attr): SubPath[] | null {
  switch (tag) {
    case 'rect':
      return rect(a);
    case 'circle': {
      const r = numberAttr(a('r'));
      return ellipse(numberAttr(a('cx')), numberAttr(a('cy')), r, r);
    }
    case 'ellipse':
      return ellipse(
        numberAttr(a('cx')),
        numberAttr(a('cy')),
        numberAttr(a('rx')),
        numberAttr(a('ry')),
      );
    case 'line':
      return points(`${a('x1') ?? 0} ${a('y1') ?? 0} ${a('x2') ?? 0} ${a('y2') ?? 0}`, false);
    case 'polyline':
      return points(a('points'), false);
    case 'polygon':
      return points(a('points'), true);
    default:
      return null;
  }
}
