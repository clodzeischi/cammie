import { offsetRegion, regionOf } from '../clipper/clipper';
import type { Path } from '../geometry/path';
import type { CutDirection, ProfileSide } from '../job/job';

export interface ProfileResult {
  /** Toolpath loops (or the original paths for `on`), not yet ordered. */
  paths: Path[];
  /** Some of the shape's outlines vanished because they're narrower than the bit. */
  lostDetail: boolean;
}

const reversed = (path: Path): Path => ({
  closed: path.closed,
  points: [...path.points].reverse(),
});

/**
 * Tool-centre paths for a profile cut. Paths must be in machine coordinates
 * (Y up); `outside`/`inside` use only closed paths, read with the even-odd rule.
 *
 * Direction: with a clockwise (M3) spindle, climb milling keeps the finished
 * wall on the right of the direction of travel. Clipper returns solid
 * boundaries counter-clockwise and holes clockwise, so:
 * - inside cuts (the shape is waste, the surroundings are kept) already climb;
 * - outside cuts (the shape is kept) climb when every loop is reversed.
 */
export function profilePaths(
  paths: readonly Path[],
  side: ProfileSide,
  bitDiameter: number,
  direction: CutDirection = 'climb',
): ProfileResult {
  if (side === 'on') return { paths: paths.slice(), lostDetail: false };

  const region = regionOf(paths);
  const radius = bitDiameter / 2;
  const loops = offsetRegion(region, side === 'outside' ? radius : -radius);

  const reverse = (side === 'outside') === (direction === 'climb');
  return {
    paths: reverse ? loops.map(reversed) : loops,
    lostDetail: loops.length < region.length,
  };
}
