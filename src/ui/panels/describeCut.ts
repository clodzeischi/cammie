import type { Operation } from '../../core/job/job';
import { grooveWidth, vbitMaxDepth, type Bit } from '../../core/tools/bits';

export const round2 = (v: number) => Math.round(v * 100) / 100;

const mm = (v: number) => `${round2(v)} mm`;

/** The note under a depth field: how wide the cut is at the surface. */
export function depthHint(bit: Bit, depth: number): string {
  if (bit.type === 'flat') return `Cut width: ${bit.diameter} mm`;
  const maxDepth = vbitMaxDepth(bit);
  return depth > maxDepth
    ? `Deeper than the cone (${round2(maxDepth)} mm): the line stops getting wider.`
    : `Line width at the surface: ${round2(grooveWidth(bit, depth))} mm`;
}

/**
 * One plain sentence saying what a toolpath will do, shown above its settings
 * so nobody has to decode CAM terms to check a cut.
 */
export function describeCut(
  op: Operation,
  bit: Bit | undefined,
  name: string,
  thickness: number,
): string {
  const bitName = bit ? bit.name : 'its bit';
  const depth = mm(op.depth);
  if (op.type === 'pocket') {
    return `Clears everything inside “${name}” down to ${depth}, leaving any islands standing, with the ${bitName}.`;
  }
  if (op.side === 'on') {
    const width = bit
      ? bit.type === 'vbit'
        ? grooveWidth(bit, Math.min(op.depth, vbitMaxDepth(bit)))
        : bit.diameter
      : null;
    return `Follows the lines of “${name}” with the ${bitName}, ${depth} deep${
      width ? `, leaving a ${mm(width)} wide line` : ''
    }.`;
  }
  const through = op.depth >= thickness;
  const held = through && op.tabs.enabled ? ', leaving tabs to hold it in place' : '';
  if (op.side === 'outside') {
    return through
      ? `Cuts “${name}” free along the outside of its outline${held}.`
      : `Cuts along the outside of “${name}”, ${depth} deep (not all the way through the ${mm(thickness)} stock).`;
  }
  return through
    ? `Cuts a hole the shape of “${name}” right through the stock${held}.`
    : `Cuts along the inside of “${name}”, ${depth} deep (not all the way through).`;
}
