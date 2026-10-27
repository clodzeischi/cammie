import { pocketOp, profileOp } from '../../core/cam/testFixtures';
import { findBit } from '../../core/tools/bits';
import { describeCut } from './describeCut';

describe('describeCut', () => {
  it('gives the line width for engraving', () => {
    const text = describeCut(profileOp({ depth: 0.4 }), findBit('vbit-60'), 'Star', 3);
    expect(text).toMatch(
      /^Follows the lines of “Star” with the V-bit 60°, 0.4 mm deep, leaving a 0.\d+ mm wide line\.$/,
    );
  });

  it('says whether a cut-out goes through and is held by tabs', () => {
    const bit = findBit('flat-3.175');
    const through = profileOp({ side: 'outside', bitId: 'flat-3.175', depth: 6.2 });
    expect(describeCut(through, bit, 'Coaster', 6)).toBe(
      'Cuts “Coaster” free along the outside of its outline, leaving tabs to hold it in place.',
    );
    const shallow = { ...through, depth: 2 };
    expect(describeCut(shallow, bit, 'Coaster', 6)).toContain('not all the way through');
  });

  it('describes pockets', () => {
    expect(describeCut(pocketOp({ depth: 2 }), findBit('flat-3.175'), 'Recess', 6)).toContain(
      'Clears everything inside “Recess” down to 2 mm',
    );
  });
});
