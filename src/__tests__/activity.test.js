import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivity } from '../activity.js';

function createOctokit({ events, compareCommits = [], compareThrows = false }) {
  return {
    async request(route, params) {
      if (route === 'GET /users/{username}/events') {
        if (params.page === 1) {
          return { data: events };
        }
        return { data: [] };
      }

      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
        if (compareThrows) {
          throw new Error('compare failed');
        }
        return { data: { commits: compareCommits } };
      }

      throw new Error(`Unexpected route in test: ${route}`);
    },
  };
}

test('uses compare commit timestamps for push events when available', async () => {
  const events = [
    {
      type: 'PushEvent',
      created_at: '2026-02-21T08:00:00Z',
      repo: { name: 'acme/repo' },
      payload: {
        size: 1,
        before: '1111111111111111111111111111111111111111',
        head: '2222222222222222222222222222222222222222',
        commits: [{ sha: 'abc123', message: 'fallback message' }],
      },
    },
  ];

  const compareCommits = [
    {
      sha: 'abc123',
      html_url: 'https://github.com/acme/repo/commit/abc123',
      commit: {
        message: 'accurate message\nwith body',
        author: { date: '2026-02-20T12:34:56Z' },
      },
    },
  ];

  const activity = await fetchActivity(
    'acme',
    'token',
    30,
    createOctokit({ events, compareCommits }),
  );

  assert.equal(activity.length, 1);
  assert.equal(activity[0].type, 'commit');
  assert.equal(activity[0].title, 'accurate message');
  assert.equal(activity[0].date, '2026-02-20T12:34:56Z');
});

test('falls back to event commits when compare request fails', async () => {
  const events = [
    {
      type: 'PushEvent',
      created_at: '2026-02-21T08:00:00Z',
      repo: { name: 'acme/repo' },
      payload: {
        size: 1,
        before: '1111111111111111111111111111111111111111',
        head: '2222222222222222222222222222222222222222',
        commits: [{ sha: 'abc123', message: 'fallback message' }],
      },
    },
  ];

  const activity = await fetchActivity(
    'acme',
    'token',
    30,
    createOctokit({ events, compareThrows: true }),
  );

  assert.equal(activity.length, 1);
  assert.equal(activity[0].title, 'fallback message');
  assert.equal(activity[0].date, '2026-02-21T08:00:00Z');
  assert.equal(activity[0].url, 'https://github.com/acme/repo/commit/abc123');
});
