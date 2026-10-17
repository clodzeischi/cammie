import { isScreenTooSmall } from './screenGate';

describe('isScreenTooSmall', () => {
  it('blocks phones', () => {
    expect(isScreenTooSmall(390, true)).toBe(true);
    expect(isScreenTooSmall(700, true)).toBe(true); // large phone in landscape
  });

  it('allows tablets', () => {
    expect(isScreenTooSmall(768, true)).toBe(false);
    expect(isScreenTooSmall(1024, true)).toBe(false);
  });

  it('allows desktop windows down to 600 px', () => {
    expect(isScreenTooSmall(700, false)).toBe(false);
    expect(isScreenTooSmall(600, false)).toBe(false);
    expect(isScreenTooSmall(599, false)).toBe(true);
  });
});
