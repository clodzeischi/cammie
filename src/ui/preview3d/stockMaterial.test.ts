import { plyCount } from './stockMaterial';

describe('plyCount', () => {
  it('gives plywood an odd number of plies, at least three', () => {
    expect(plyCount(3)).toBe(3);
    expect(plyCount(6)).toBe(5);
    expect(plyCount(12)).toBe(9);
    expect(plyCount(18)).toBe(13);
  });
});
