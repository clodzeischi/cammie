import { describe, expect, it } from 'vitest';
import { findBit } from '../tools/bits';
import { holeOperation } from './objectFactory';

const flat = findBit('flat-3.175')!;

describe('holes', () => {
  it('drills a hole the size of the bit', () => {
    expect(holeOperation(3.175, 6.2, flat, 6)).toMatchObject({ type: 'drill', depth: 6.2 });
  });

  it('cuts bigger holes round from the inside', () => {
    expect(holeOperation(8, 6.2, flat, 6)).toMatchObject({
      type: 'profile',
      side: 'inside',
      bitId: 'flat-3.175',
      depth: 6.2,
    });
  });

  it('refuses a bit wider than the hole', () => {
    expect(holeOperation(2, 6.2, flat, 6)).toBeNull();
  });
});
