import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRepos } from '../repos.js';

function buildRepo(id, options = {}) {
  const suffix = options.fork ? `fork-${id}` : `${id}`;
  return {
    name: `repo-${suffix}`,
    description: options.description ?? null,
    language: options.language ?? 'JavaScript',
    stargazers_count: options.stars ?? id,
    html_url: `https://github.com/acme/repo-${suffix}`,
    fork: Boolean(options.fork),
    archived: Boolean(options.archived),
  };
}

test('paginates beyond 100 and counts only eligible repositories', async () => {
  const requestedPages = [];
  const pageOne = [
    ...Array.from({ length: 90 }, (_, index) => buildRepo(index + 1)),
    ...Array.from({ length: 10 }, (_, index) => buildRepo(index + 1, { fork: true })),
  ];
  const pageTwo = Array.from({ length: 25 }, (_, index) => buildRepo(index + 101));

  const octokit = {
    async request(route, params) {
      assert.equal(route, 'GET /users/{username}/repos');
      requestedPages.push(params.page);
      if (params.page === 1) {
        return { data: pageOne };
      }
      if (params.page === 2) {
        return { data: pageTwo };
      }
      return { data: [] };
    },
  };

  const repositories = await fetchRepos('acme', 'token', 108, { octokit });

  assert.equal(repositories.length, 108);
  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(repositories[0].name, 'repo-1');
  assert.equal(repositories[107].name, 'repo-118');
  assert.equal(repositories.some((repo) => repo.name.includes('fork-')), false);
});

test('returns partial list and warns when fewer eligible repositories exist', async () => {
  const warnings = [];
  const pageOne = Array.from({ length: 5 }, (_, index) => buildRepo(index + 1));

  const octokit = {
    async request() {
      return { data: pageOne };
    },
  };

  const repositories = await fetchRepos('acme', 'token', 10, {
    octokit,
    onWarning: (message) => warnings.push(message),
  });

  assert.equal(repositories.length, 5);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Requested 10 repositories, but found 5 eligible repositories/);
});
