import type { Vec2 } from '../../geometry/path';
import type { Feeds } from '../../materials/materials';
import type { Move } from '../program';
import type { Vertex3 } from './loopPass';

/** Height above a surface where rapids stop and feeding begins. */
export const APPROACH_CLEARANCE = 0.5;

/**
 * Builds a move list while tracking where the tool is. Operations start and
 * end at safe Z (see ProgramSection).
 */
export class MoveWriter {
  readonly moves: Move[] = [];
  private pos: Vertex3;

  constructor(
    private readonly safeZ: number,
    private readonly feeds: Feeds,
    start: Vec2,
  ) {
    this.pos = { x: start.x, y: start.y, z: safeZ };
  }

  get position(): Vertex3 {
    return this.pos;
  }

  get atSafeZ(): boolean {
    return this.pos.z >= this.safeZ;
  }

  rapid(x: number, y: number, z: number) {
    this.moves.push({ kind: 'rapid', x, y, z });
    this.pos = { x, y, z };
  }

  feed(x: number, y: number, z: number, feed: number) {
    this.moves.push({ kind: 'feed', x, y, z, feed });
    this.pos = { x, y, z };
  }

  /** Straight up to safe Z. */
  retract() {
    if (!this.atSafeZ) this.rapid(this.pos.x, this.pos.y, this.safeZ);
  }

  /**
   * Travel to (x, y) and get down to `surfaceZ` (the top of whatever is
   * already cut there): retract, rapid across, rapid to just above, feed the rest.
   */
  approach(p: Vec2, surfaceZ: number) {
    this.retract();
    this.rapid(p.x, p.y, this.safeZ);
    const clearance = Math.min(surfaceZ + APPROACH_CLEARANCE, this.safeZ);
    this.rapid(p.x, p.y, clearance);
    this.feed(p.x, p.y, surfaceZ, this.feeds.plunge);
  }

  /** Follows a 3D polyline: straight-down moves at plunge feed, everything else at cutting feed. */
  follow(vertices: readonly Vertex3[]) {
    for (const v of vertices) {
      const flat = Math.hypot(v.x - this.pos.x, v.y - this.pos.y) < 1e-6;
      if (flat && Math.abs(v.z - this.pos.z) < 1e-9) continue;
      this.feed(v.x, v.y, v.z, flat && v.z < this.pos.z ? this.feeds.plunge : this.feeds.feed);
    }
  }
}
