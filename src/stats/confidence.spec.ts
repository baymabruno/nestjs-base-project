import { wilsonLowerBound, wilsonUpperBound } from './confidence.js';

describe('wilsonLowerBound', () => {
  it('is 0 without matches', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('is far below the observed rate for a small sample', () => {
    expect(wilsonLowerBound(10, 12)).toBeCloseTo(0.552, 3);
  });

  it('approaches the observed rate as the sample grows', () => {
    expect(wilsonLowerBound(550, 1000)).toBeCloseTo(0.519, 3);
    expect(wilsonLowerBound(55000, 100000)).toBeCloseTo(0.5469, 3);
  });

  it('ranks a large sample above a small one with a higher rate', () => {
    // 55% in 1000 matches against 75% in 8
    expect(wilsonLowerBound(6, 8)).toBeCloseTo(0.4093, 3);
    expect(wilsonLowerBound(550, 1000)).toBeGreaterThan(wilsonLowerBound(6, 8));
  });

  it('stays between 0 and 1', () => {
    expect(wilsonLowerBound(0, 50)).toBeCloseTo(0, 10);
    expect(wilsonLowerBound(50, 50)).toBeLessThan(1);
  });

  describe('wilsonUpperBound', () => {
    it('is 1 without matches', () => {
      expect(wilsonUpperBound(0, 0)).toBe(1);
    });

    it('is far above the observed rate for a small sample', () => {
      // 2 wins in 8 (25%) can still be 59%
      expect(wilsonUpperBound(2, 8)).toBeCloseTo(0.5907, 3);
    });

    it('mirrors the lower bound', () => {
      expect(wilsonUpperBound(2, 8)).toBeCloseTo(
        1 - wilsonLowerBound(6, 8),
        10,
      );
    });
  });
});
