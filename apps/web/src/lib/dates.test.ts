import { describe, expect, it } from 'vitest';
import {
  addDays,
  localDayOfWeek,
  localIsoDate,
  localIsoDateDaysAgo,
  mondayOf,
  parseLocalDate,
} from './dates';

// Dates are built with the local-time constructor, so these hold in any zone
// the test runner happens to be in.
const lateEvening = new Date(2026, 9, 10, 23, 30); // Sat Oct 10, 11:30pm local

describe('localIsoDate', () => {
  it('keys a late-evening moment by the local day, not the UTC day', () => {
    expect(localIsoDate(lateEvening)).toBe('2026-10-10');
    // The UTC key is what the app used to produce; it only agrees with the
    // local key when the zone is at or ahead of UTC at that moment.
    const utcKey = lateEvening.toISOString().slice(0, 10);
    if (lateEvening.getTimezoneOffset() > 30) expect(utcKey).toBe('2026-10-11');
  });

  it('zero-pads months and days', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
  });
});

describe('parseLocalDate', () => {
  it('returns local midnight of the key', () => {
    const d = parseLocalDate('2026-10-10');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 10, 0]);
  });

  it('round-trips with localIsoDate', () => {
    expect(localIsoDate(parseLocalDate('2026-03-08'))).toBe('2026-03-08');
  });
});

describe('addDays / localIsoDateDaysAgo', () => {
  it('steps across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(localIsoDateDaysAgo(7, lateEvening)).toBe('2026-10-03');
  });

  it('counts calendar days across a DST change', () => {
    // US spring-forward is Mar 8 2026; a 24h-based shift would land a day off
    // in zones that observe it.
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('localDayOfWeek / mondayOf', () => {
  it('uses Monday = 0', () => {
    expect(localDayOfWeek(new Date(2026, 9, 12))).toBe(0); // Monday
    expect(localDayOfWeek(new Date(2026, 9, 11))).toBe(6); // Sunday
  });

  it('finds the Monday of the week, including for a Sunday', () => {
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
    expect(mondayOf('2026-10-10')).toBe('2026-10-05');
  });
});
