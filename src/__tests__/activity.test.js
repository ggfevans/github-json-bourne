import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivity } from '../activity.js';

const HOUR_MS = 3600000;

function isoHoursAgo(hoursAgo) {
  return new Date(Date.now() - hoursAgo * HOUR_MS).toISOString();
}

function issueEvent(id, hoursAgo) {
  return {
    type: 'IssuesEvent',
    created_at: isoHoursAgo(hoursAgo),
    repo: { name: 'acme/project' },
    payload: {
      issue: {
        title: `Issue ${id}`,
        html_url: `https://github.com/acme/project/issues/${id}`,
        state: 'open',
      },
    },
  };
}

function pushEvent(id, hoursAgo, size = 30) {
  return {
    type: 'PushEvent',
    created_at: isoHoursAgo(hoursAgo),
    repo: { name: 'acme/project' },
    payload: {
      size,
      before: `${id}`.padStart(40, 'a'),
      head: `${id}`.padStart(40, 'b'),
      commits: [
        {
          sha: `${id}`.padStart(40, 'c'),
          message: `Commit ${id}`,
        },
      ],
    },
  };
}

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

test('stops fetching additional pages when older pages cannot change top N', async () => {
  const pageRequests = [];
  const eventsPageOne = Array.from({ length: 100 }, (_, index) => issueEvent(index + 1, index));

  const octokit = {
    async request(route, params) {
      if (route === 'GET /users/{username}/events') {
        pageRequests.push(params.page);
        if (params.page === 1) {
          return { data: eventsPageOne };
        }
        return { data: [] };
      }
      throw new Error(`Unexpected route: ${route}`);
    },
  };

  const result = await fetchActivity('acme', 'token', 2, { octokit, maxPages: 3 });

  assert.equal(result.length, 2);
  assert.equal(result[0].url, 'https://github.com/acme/project/issues/1');
  assert.equal(result[1].url, 'https://github.com/acme/project/issues/2');
  assert.deepEqual(pageRequests, [1]);
});

test('only calls compare for competitive large push events', async () => {
  let compareCalls = 0;
  const recentPush = pushEvent(1, 0, 25);
  const oldPush = pushEvent(2, 72, 40);

  const octokit = {
    async request(route, params) {
      if (route === 'GET /users/{username}/events') {
        return { data: [recentPush, oldPush] };
      }

      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
        compareCalls += 1;
        return {
          data: {
            commits: [
              {
                sha: 'd'.repeat(40),
                html_url: 'https://github.com/acme/project/commit/compare-1',
                commit: {
                  message: 'Expanded commit',
                  author: { date: isoHoursAgo(0) },
                },
              },
            ],
          },
        };
      }

      throw new Error(`Unexpected route: ${route}`);
    },
  };

  const result = await fetchActivity('acme', 'token', 1, { octokit, maxPages: 3 });

  assert.equal(compareCalls, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://github.com/acme/project/commit/compare-1');
});

test('respects maxPages limit when additional pages remain available', async () => {
  const pageRequests = [];
  const octokit = {
    async request(route, params) {
      if (route !== 'GET /users/{username}/events') {
        throw new Error(`Unexpected route: ${route}`);
      }

      pageRequests.push(params.page);
      const offset = (params.page - 1) * 100;
      return {
        data: Array.from({ length: 100 }, (_, index) => issueEvent(offset + index + 1, offset + index)),
      };
    },
  };

  const result = await fetchActivity('acme', 'token', 500, { octokit, maxPages: 2 });

  assert.equal(result.length, 200);
  assert.deepEqual(pageRequests, [1, 2]);
});

test('uses compare commit timestamps for push events when available', async () => {
  const events = [
    {
      type: 'PushEvent',
      created_at: '2026-02-21T08:00:00Z',
      repo: { name: 'acme/repo' },
      payload: {
        size: 25,
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
        size: 25,
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
