import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../schema.js';

function buildValidData() {
  return {
    lastUpdated: new Date().toISOString(),
    contributions: {
      total: 10,
      commits: 4,
      pullRequests: 2,
      pullRequestReviews: 1,
      issues: 2,
      restricted: 1,
    },
    calendar: {
      weeks: [
        {
          days: [
            { date: '2026-01-01', count: 1, level: 1 },
            { date: '2026-01-02', count: 0, level: 0 },
          ],
        },
      ],
    },
    streak: {
      current: 1,
      longest: 3,
      today: false,
    },
    recentActivity: [
      {
        type: 'commit',
        repo: 'repo',
        repoUrl: 'https://github.com/acme/repo',
        title: 'feat: add thing',
        url: 'https://github.com/acme/repo/commit/abc',
        date: '2026-01-01T00:00:00.000Z',
      },
    ],
    stats: {
      commitsThisWeek: 1,
      commitsThisMonth: 2,
      contributionsThisWeek: 3,
      contributionsThisMonth: 4,
      repositoriesThisWeek: 1,
    },
    repositories: [
      {
        name: 'repo',
        description: '',
        language: 'TypeScript',
        languageColor: '#3178c6',
        stars: 10,
        url: 'https://github.com/acme/repo',
      },
    ],
  };
}

test('accepts valid payload', () => {
  assert.doesNotThrow(() => validate(buildValidData()));
});

test('rejects missing top-level keys', () => {
  const data = buildValidData();
  delete data.stats;

  assert.throws(() => validate(data), /missing key "stats"/);
});

test('rejects invalid calendar level', () => {
  const data = buildValidData();
  data.calendar.weeks[0].days[0].level = 9;

  assert.throws(() => validate(data), /expected value between 0 and 4/);
});

test('rejects invalid activity type', () => {
  const data = buildValidData();
  data.recentActivity[0].type = 'discussion';

  assert.throws(() => validate(data), /expected commit, pr, or issue/);
});
