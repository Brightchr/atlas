import { describe, expect, it } from 'vitest';
import { pickNextUp } from './nextUp';

// Mon = push, Wed = pull, Fri = legs.
const week = [
  { dayOfWeek: 0, workoutId: 'push' },
  { dayOfWeek: 2, workoutId: 'pull' },
  { dayOfWeek: 4, workoutId: 'legs' },
];
// Local-time timestamps on known weekdays (2026-11-16 is a Monday).
const monday = new Date(2026, 10, 16, 18).toISOString();
const friday = new Date(2026, 10, 20, 18).toISOString();

describe('pickNextUp', () => {
  it('returns nothing for a plan with no workouts', () => {
    expect(pickNextUp([], [], 0)).toBeUndefined();
  });

  it('starts with today or the next day ahead when nothing is done yet', () => {
    expect(pickNextUp(week, [], 0)?.workoutId).toBe('push');
    expect(pickNextUp(week, [], 1)?.workoutId).toBe('pull');
    expect(pickNextUp(week, [], 5)?.workoutId).toBe('push'); // wraps to Monday
  });

  it('keeps a missed workout next instead of skipping it', () => {
    // Push was done Monday; it is now Thursday and Wednesday was missed.
    const finished = [{ workoutId: 'push', startedAt: monday }];
    expect(pickNextUp(week, finished, 3)?.workoutId).toBe('pull');
  });

  it('wraps from the last workout of the week to the first', () => {
    const finished = [{ workoutId: 'legs', startedAt: friday }];
    expect(pickNextUp(week, finished, 5)?.workoutId).toBe('push');
  });

  it('ignores extras and workouts that are not in the plan', () => {
    const finished = [
      { workoutId: null, startedAt: friday }, // an extra, logged later
      { workoutId: 'other', startedAt: friday },
      { workoutId: 'push', startedAt: monday },
    ];
    expect(pickNextUp(week, finished, 4)?.workoutId).toBe('pull');
  });

  it('tells apart a routine that sits on two days', () => {
    const twice = [
      { dayOfWeek: 0, workoutId: 'upper' },
      { dayOfWeek: 2, workoutId: 'lower' },
      { dayOfWeek: 4, workoutId: 'upper' },
    ];
    // Upper done on Friday -> next is Monday's upper, not Wednesday's lower.
    expect(pickNextUp(twice, [{ workoutId: 'upper', startedAt: friday }], 5)).toEqual(twice[0]);
    expect(pickNextUp(twice, [{ workoutId: 'upper', startedAt: monday }], 1)).toEqual(twice[1]);
  });
});
