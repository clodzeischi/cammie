import { arcToCubics, quadToCubic } from '../../geometry/bezier';
import type { Vec2 } from '../../geometry/path';

/** A drawing step in user units: straight line or cubic Bézier to `to`. */
export type Segment = { kind: 'line'; to: Vec2 } | { kind: 'cubic'; c1: Vec2; c2: Vec2; to: Vec2 };

export interface SubPath {
  start: Vec2;
  segments: Segment[];
  closed: boolean;
}

/** Parameters per command letter. */
const ARITY: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

/** Splits path data into command letters and numbers. Arc flags may be packed ("a1 1 0 01 5 5"). */
function tokenize(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const number = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  let command = '';
  let paramIndex = 0;
  let i = 0;
  while (i < d.length) {
    const ch = d[i]!;
    if (/[\s,]/.test(ch)) {
      i++;
    } else if (/[a-zA-Z]/.test(ch)) {
      tokens.push(ch);
      command = ch.toLowerCase();
      paramIndex = 0;
      i++;
    } else if (
      command === 'a' &&
      (paramIndex % 7 === 3 || paramIndex % 7 === 4) &&
      (ch === '0' || ch === '1')
    ) {
      tokens.push(Number(ch)); // a flag is exactly one digit
      paramIndex++;
      i++;
    } else {
      number.lastIndex = i;
      const match = number.exec(d);
      if (!match) break; // garbage: stop, keep what parsed so far (as browsers do)
      tokens.push(Number(match[0]));
      paramIndex++;
      i = number.lastIndex;
    }
  }
  return tokens;
}

/** Parses SVG path data into subpaths of lines and cubics (arcs and quadratics converted). */
export function parsePathData(d: string): SubPath[] {
  const tokens = tokenize(d);
  const subpaths: SubPath[] = [];
  let current: SubPath | null = null;
  let pos: Vec2 = { x: 0, y: 0 };
  let lastCubicControl: Vec2 | null = null;
  let lastQuadControl: Vec2 | null = null;
  let i = 0;
  let command = '';

  const startSubpath = (p: Vec2) => {
    current = { start: p, segments: [], closed: false };
    subpaths.push(current);
  };
  const add = (segment: Segment) => {
    if (!current) startSubpath(pos);
    current!.segments.push(segment);
    pos = segment.to;
  };

  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') command = tokens[i++] as string;
    // Numbers with no command to repeat (at the start, or after Z) are malformed: stop.
    else if (!command || command.toLowerCase() === 'z') break;
    const lower = command.toLowerCase();
    const relative = command !== command.toUpperCase();
    const n = ARITY[lower];
    if (n === undefined) break;
    const args = tokens.slice(i, i + n) as number[];
    if (args.length < n || args.some((a) => typeof a !== 'number')) break;
    i += n;
    const pt = (x: number, y: number): Vec2 =>
      relative ? { x: pos.x + x, y: pos.y + y } : { x, y };
    let cubicControl: Vec2 | null = null;
    let quadControl: Vec2 | null = null;

    switch (lower) {
      case 'm':
        pos = pt(args[0]!, args[1]!);
        startSubpath(pos);
        command = relative ? 'l' : 'L'; // extra pairs after M are line-tos
        break;
      case 'l':
        add({ kind: 'line', to: pt(args[0]!, args[1]!) });
        break;
      case 'h':
        add({ kind: 'line', to: { x: relative ? pos.x + args[0]! : args[0]!, y: pos.y } });
        break;
      case 'v':
        add({ kind: 'line', to: { x: pos.x, y: relative ? pos.y + args[0]! : args[0]! } });
        break;
      case 'c': {
        const c1 = pt(args[0]!, args[1]!);
        cubicControl = pt(args[2]!, args[3]!);
        add({ kind: 'cubic', c1, c2: cubicControl, to: pt(args[4]!, args[5]!) });
        break;
      }
      case 's': {
        const c1 = lastCubicControl
          ? { x: 2 * pos.x - lastCubicControl.x, y: 2 * pos.y - lastCubicControl.y }
          : pos;
        cubicControl = pt(args[0]!, args[1]!);
        add({ kind: 'cubic', c1, c2: cubicControl, to: pt(args[2]!, args[3]!) });
        break;
      }
      case 'q':
      case 't': {
        quadControl =
          lower === 'q'
            ? pt(args[0]!, args[1]!)
            : lastQuadControl
              ? { x: 2 * pos.x - lastQuadControl.x, y: 2 * pos.y - lastQuadControl.y }
              : pos;
        const to = lower === 'q' ? pt(args[2]!, args[3]!) : pt(args[0]!, args[1]!);
        const [c1, c2] = quadToCubic(pos, quadControl, to);
        add({ kind: 'cubic', c1, c2, to });
        break;
      }
      case 'a': {
        const to = pt(args[5]!, args[6]!);
        for (const [c1, c2, end] of arcToCubics(
          pos,
          args[0]!,
          args[1]!,
          args[2]!,
          args[3] === 1,
          args[4] === 1,
          to,
        )) {
          add({ kind: 'cubic', c1, c2, to: end });
        }
        pos = to;
        break;
      }
      case 'z':
        if (current) {
          (current as SubPath).closed = true;
          pos = (current as SubPath).start;
          current = null; // a following command starts a new subpath at the start point
        }
        break;
    }
    lastCubicControl = cubicControl;
    lastQuadControl = quadControl;
  }
  return subpaths;
}
