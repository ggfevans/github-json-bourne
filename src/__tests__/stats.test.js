import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats } from '../stats.js';

const DAY_MS = 86400000;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function dateDaysAgo(days) {
  return isoDaysAgo(days).slice(0, 10);
}

test('calculates weekly and monthly stats from calendar and activity', () => {
  const calendar = {
    weeks: [
      {
        days: [
          { date: dateDaysAgo(0), count: 2, level: 1 },
          { date: dateDaysAgo(3), count: 4, level: 2 },
          { date: dateDaysAgo(12), count: 5, level: 3 },
          { date: dateDaysAgo(31), count: 7, level: 4 },
        ],
      },
    ],
  };

  const activity = [
    { type: 'commit', repo: 'alpha', date: isoDaysAgo(1) },
    { type: 'commit', repo: 'alpha', date: isoDaysAgo(5) },
    { type: 'commit', repo: 'beta', date: isoDaysAgo(20) },
    { type: 'commit', repo: 'gamma', date: isoDaysAgo(40) },
    { type: 'issue', repo: 'delta', date: isoDaysAgo(2) },
  ];

  const result = calculateStats(calendar, activity);

  assert.equal(result.commitsThisWeek, 2);
  assert.equal(result.commitsThisMonth, 3);
  assert.equal(result.contributionsThisWeek, 6);
  assert.equal(result.contributionsThisMonth, 11);
  assert.equal(result.repositoriesThisWeek, 2);
});
