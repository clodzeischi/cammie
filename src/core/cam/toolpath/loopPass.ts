import type { Loop } from './loop';

export interface Vertex3 {
  x: number;
  y: number;
  z: number;
}

export interface LoopPassParams {
  loop: Loop;
  /** Where on the loop to start (mm along it). */
  start: number;
  /** Depth the tool is at when the pass begins. */
  fromZ: number;
  /** Depth of this pass. */
  toZ: number;
  /** Distance over which to ease down to toZ; 0 = plunge straight down. */
  rampLength: number;
  /** Stretches of the loop (mm along it) where the tool lifts over a tab. */
  tabs: ReadonlyArray<[number, number]>;
  /** Top of the tabs; the tool never goes below this inside a tab. */
  tabZ: number;
}

/**
 * One depth pass around a closed loop, as a 3D polyline.
 *
 * With a ramp, the tool descends along the first `rampLength` mm (wrapping round
 * the loop if it's longer than one lap), then goes one full lap at depth, which
 * also re-cuts the sloped ramp section flat. It ends `rampLength` past the start,
 * which is where the next pass picks up. Without a ramp it plunges and does one lap.
 * Tabs clamp the depth, with vertical moves at their edges.
 */
export function loopPass(params: LoopPassParams): { vertices: Vertex3[]; end: number } {
  const { loop, start, fromZ, toZ, tabs, tabZ } = params;
  const ramp = params.rampLength > 0 && toZ < fromZ ? params.rampLength : 0;
  const end = start + ramp + loop.perimeter;

  const depthAt = (s: number) =>
    ramp > 0 && s < start + ramp ? fromZ + ((toZ - fromZ) * (s - start)) / ramp : toZ;

  const positions = [
    start,
    end,
    ...(ramp > 0 ? [start + ramp] : []),
    ...loop.vertexPositionsBetween(start, end),
    ...(tabs.length > 0 ? loop.intervalBoundariesBetween(start, end, tabs) : []),
  ].sort((a, b) => a - b);

  const vertices: Vertex3[] = [];
  const emit = (s: number, z: number) => {
    const { x, y } = loop.pointAt(s);
    const last = vertices[vertices.length - 1];
    const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    if (last && same(last.x, x) && same(last.y, y) && same(last.z, z)) return;
    vertices.push({ x, y, z });
  };

  if (ramp === 0) emit(start, fromZ); // the plunge starts from here
  for (let i = 0; i + 1 < positions.length; i++) {
    const a = positions[i]!;
    const b = positions[i + 1]!;
    if (b - a < 1e-9) continue;
    const overTab = tabs.length > 0 && loop.inIntervals((a + b) / 2, tabs);
    const z = (s: number) => (overTab ? Math.max(depthAt(s), tabZ) : depthAt(s));
    emit(a, z(a));
    emit(b, z(b));
  }
  return { vertices, end };
}
