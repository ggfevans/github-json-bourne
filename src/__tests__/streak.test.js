import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreak } from '../streak.js';

const DAY_MS = 86400000;

function dateDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

function calendarFromCounts(countsByDaysAgo) {
  const days = countsByDaysAgo.map(([daysAgo, count]) => ({
    date: dateDaysAgo(daysAgo),
    count,
    level: count > 0 ? 1 : 0,
  }));

  return { weeks: [{ days }] };
}

test('returns zero streaks for empty calendar', () => {
  const result = calculateStreak({ weeks: [] });
  assert.deepEqual(result, { current: 0, longest: 0, today: false });
});

test('counts current streak when today has contributions', () => {
  const calendar = calendarFromCounts([
    [0, 3],
    [1, 1],
    [2, 1],
    [3, 0],
  ]);

  const result = calculateStreak(calendar);
  assert.equal(result.today, true);
  assert.equal(result.current, 3);
  assert.equal(result.longest, 3);
});

test('skips empty today before counting streak', () => {
  const calendar = calendarFromCounts([
    [0, 0],
    [1, 2],
    [2, 1],
    [3, 0],
  ]);

  const result = calculateStreak(calendar);
  assert.equal(result.today, false);
  assert.equal(result.current, 2);
  assert.equal(result.longest, 2);
});

test('tracks longest streak across multiple runs', () => {
  const calendar = calendarFromCounts([
    [0, 1],
    [1, 1],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 0],
  ]);

  const result = calculateStreak(calendar);
  assert.equal(result.current, 2);
  assert.equal(result.longest, 3);
});
