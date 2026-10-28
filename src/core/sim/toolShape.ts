import type { Bit } from '../tools/bits';

/**
 * The cutting end of a bit as a surface of revolution: how far above the tip
 * the bit cuts at distance `r` from its axis. Infinity outside the bit.
 */
export interface ToolShape {
  radius: number;
  heightAt(r: number): number;
}

export function toolShape(bit: Bit): ToolShape {
  const radius = bit.diameter / 2;
  if (bit.type === 'flat') {
    return { radius, heightAt: (r) => (r <= radius ? 0 : Infinity) };
  }
  if (bit.type === 'round') {
    return {
      radius,
      heightAt: (r) => (r <= radius ? radius - Math.sqrt(radius * radius - r * r) : Infinity),
    };
  }
  // V-bit: a flat tip, then the cone out to the full diameter.
  const tip = bit.tipDiameter / 2;
  const slope = 1 / Math.tan((bit.angle * Math.PI) / 360);
  return {
    radius,
    heightAt: (r) => (r > radius ? Infinity : r <= tip ? 0 : (r - tip) * slope),
  };
}
