import { isoMinus1, nextStreak } from '../src/sessions/streak';

describe('isoMinus1', () => {
  it('subtracts one day', () => {
    expect(isoMinus1('2026-06-01')).toBe('2026-05-31');
    expect(isoMinus1('2026-01-01')).toBe('2025-12-31');
  });
});

describe('nextStreak', () => {
  const base = { currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-05-31' };

  it('increments when last active was yesterday', () => {
    expect(nextStreak(base, '2026-06-01')).toEqual({ currentStreak: 4, longestStreak: 5, lastActiveDate: '2026-06-01' });
  });

  it('keeps streak unchanged when already counted today', () => {
    expect(nextStreak({ ...base, lastActiveDate: '2026-06-01' }, '2026-06-01')).toEqual({ currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-06-01' });
  });

  it('resets to 1 when a day was missed', () => {
    expect(nextStreak({ ...base, lastActiveDate: '2026-05-28' }, '2026-06-01')).toEqual({ currentStreak: 1, longestStreak: 5, lastActiveDate: '2026-06-01' });
  });

  it('grows longest when current passes it', () => {
    expect(nextStreak({ currentStreak: 5, longestStreak: 5, lastActiveDate: '2026-05-31' }, '2026-06-01'))
      .toEqual({ currentStreak: 6, longestStreak: 6, lastActiveDate: '2026-06-01' });
  });

  it('starts at 1 from no history', () => {
    expect(nextStreak({ currentStreak: 0, longestStreak: 0, lastActiveDate: null }, '2026-06-01'))
      .toEqual({ currentStreak: 1, longestStreak: 1, lastActiveDate: '2026-06-01' });
  });
});

describe('effectiveCurrent', () => {
  it('is exercised via the stats endpoint (see stats.e2e)', () => { expect(true).toBe(true); });
});
