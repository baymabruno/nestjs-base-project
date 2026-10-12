import { percentile, scoreHeroes, tierOf } from './score.js';

describe('score', () => {
  it('places a value among the others, sharing ties', () => {
    const place = percentile([1, 2, 2, 3]);
    expect(place(1)).toBe(0);
    expect(place(2)).toBe(0.5);
    expect(place(3)).toBe(1);
    // a single hero is in the middle
    expect(percentile([7])(7)).toBe(0.5);
  });

  it('gives the tiers from the score', () => {
    expect([80, 79, 65, 50, 35, 34].map(tierOf)).toEqual([
      'S',
      'A',
      'A',
      'B',
      'C',
      'D',
    ]);
  });

  it('weights the adjusted win rate (70%) and the pick rate (30%)', () => {
    const heroes = scoreHeroes([
      { id: 1, winRateLow: 0.45, pickRate: 0.2, matches: 10 },
      { id: 2, winRateLow: 0.55, pickRate: 0.01, matches: 5 },
      { id: 3, winRateLow: 0.5, pickRate: 0.1, matches: 8 },
    ]);

    expect(heroes.map((hero) => [hero.id, hero.score, hero.tier])).toEqual([
      [2, 70, 'A'],
      [3, 50, 'B'],
      [1, 30, 'D'],
    ]);
  });

  it('breaks ties by the matches', () => {
    const heroes = scoreHeroes([
      { id: 1, winRateLow: 0.5, pickRate: 0.1, matches: 5 },
      { id: 2, winRateLow: 0.5, pickRate: 0.1, matches: 9 },
    ]);

    expect(heroes.map((hero) => hero.id)).toEqual([2, 1]);
  });
});
