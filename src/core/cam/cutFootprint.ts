import { offsetRegion, regionOf } from '../clipper/clipper';
import type { Path, Vec2 } from '../geometry/path';
import type { Operation } from '../job/job';
import { chamferWidth, grooveWidth, type Bit } from '../tools/bits';
import { holeCentres } from './drillPlan';

/**
 * What a cut removes, seen from above, for showing on the design (SPEC.md
 * §9.11). Everything is in the object's own space, so it can be drawn with
 * the object's transform and follow it while it's dragged.
 */
export interface CutFootprint {
  /** Bands of `width` mm drawn along a path with round ends and joins. */
  bands: Array<{ path: Path; width: number }>;
  /** Areas filled with the even-odd rule (inner outlines are islands). */
  area: Path[];
  /** Round holes (drilling). */
  holes: Array<{ centre: Vec2; diameter: number }>;
}

const EMPTY: CutFootprint = { bands: [], area: [], holes: [] };

/**
 * The cut's footprint at the object's scale. `scale` is the object's average
 * scale: footprint sizes are real millimetres, so they're divided by it to
 * come out right once the object's transform is applied.
 *
 * - Engrave (on the line): a groove as wide as the bit cuts at that depth, centred on the line.
 * - Profile outside / inside: the bit's sweep just outside / inside the line.
 * - Pocket, V-carve: the whole area inside the shape.
 * - Chamfer: the bevel's width, on the kept side of the edge.
 * - Drill: a bit-sized hole at each shape's centre.
 */
export function cutFootprint(
  paths: readonly Path[],
  operation: Operation,
  bit: Bit,
  scale = 1,
): CutFootprint {
  const closed = paths.filter((p) => p.closed);
  const k = scale > 0 ? 1 / scale : 1;
  const band = (centres: readonly Path[], width: number) =>
    centres.map((path) => ({ path, width: width * k }));

  switch (operation.type) {
    case 'pocket':
    case 'vcarve':
      return { ...EMPTY, area: regionOf(closed) };
    case 'drill':
      return {
        ...EMPTY,
        holes: holeCentres(closed).map((centre) => ({ centre, diameter: bit.diameter * k })),
      };
    case 'chamfer': {
      if (bit.type !== 'vbit') return EMPTY;
      const width = chamferWidth(bit, operation.depth);
      // An outside chamfer bevels the part, so it eats into the shape (offset in);
      // an inside one bevels the hole's rim, around the shape (offset out).
      const direction = operation.side === 'outside' ? -1 : 1;
      return {
        ...EMPTY,
        bands: band(offsetRegion(regionOf(closed), (direction * width * k) / 2), width),
      };
    }
    case 'profile': {
      const width = grooveWidth(bit, operation.depth);
      if (operation.side === 'on') return { ...EMPTY, bands: band(paths, width) };
      const outward = operation.side === 'outside' ? 1 : -1;
      const centres = offsetRegion(regionOf(closed), (outward * width * k) / 2);
      return { ...EMPTY, bands: band(centres, width) };
    }
  }
}
