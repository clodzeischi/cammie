import type { Vec2 } from '../core/geometry/path';
import type { DesignObject, ShapeParams } from '../core/job/job';
import { finite, isObject, oneOf, str, type Loose } from './reviveValues';

/** Every object kind a project file may contain. */
export const OBJECT_KINDS: readonly DesignObject['kind'][] = [
  'traced-image',
  'svg',
  'text',
  'rect',
  'ellipse',
  'polygon',
  'star',
  'cog',
  'polyline',
];

const sized = (s: Loose) => finite(s.width) && finite(s.height);
const isPoint = (p: unknown): p is Vec2 => isObject(p) && finite(p.x) && finite(p.y);

/**
 * A shape's parameters from a project file, or undefined when they're
 * missing or broken: the object then keeps its outlines but can't be edited
 * as a shape.
 */
export function reviveShape(s: unknown): ShapeParams | undefined {
  if (!isObject(s)) return undefined;
  const { width, height } = s as { width: number; height: number };
  switch (s.type) {
    case 'rect':
      return sized(s) && finite(s.cornerRadius)
        ? { type: 'rect', width, height, cornerRadius: s.cornerRadius }
        : undefined;
    case 'ellipse':
      return sized(s) ? { type: 'ellipse', width, height } : undefined;
    case 'polygon':
      return sized(s) && finite(s.sides)
        ? { type: 'polygon', width, height, sides: s.sides }
        : undefined;
    case 'star':
      return sized(s) && finite(s.points) && finite(s.innerRatio)
        ? { type: 'star', width, height, points: s.points, innerRatio: s.innerRatio }
        : undefined;
    case 'cog':
      return sized(s) &&
        finite(s.teeth) &&
        finite(s.toothDepth) &&
        finite(s.toothWidth) &&
        finite(s.boreDiameter)
        ? {
            type: 'cog',
            width,
            height,
            teeth: s.teeth,
            toothDepth: s.toothDepth,
            toothWidth: s.toothWidth,
            boreDiameter: s.boreDiameter,
          }
        : undefined;
    case 'polyline':
      return Array.isArray(s.points) && s.points.every(isPoint) && finite(s.smoothing)
        ? {
            type: 'polyline',
            points: s.points.map((p) => ({ x: p.x, y: p.y })),
            closed: s.closed === true,
            smoothing: s.smoothing,
          }
        : undefined;
    case 'text':
      return str(s.text) &&
        str(s.fontId) &&
        finite(s.capHeight) &&
        finite(s.letterSpacing) &&
        finite(s.lineSpacing) &&
        oneOf(s.align, ['left', 'center', 'right'] as const)
        ? {
            type: 'text',
            text: s.text,
            fontId: s.fontId,
            capHeight: s.capHeight,
            letterSpacing: s.letterSpacing,
            lineSpacing: s.lineSpacing,
            align: s.align,
          }
        : undefined;
    default:
      return undefined;
  }
}
