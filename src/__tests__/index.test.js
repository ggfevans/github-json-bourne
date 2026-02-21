import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createCoreMock(inputs, hooks = {}) {
  return {
    getInput(name) {
      return inputs[name] ?? '';
    },
    info(message) {
      hooks.info?.(message);
    },
    warning(message) {
      hooks.warning?.(message);
    },
    setOutput(name, value) {
      hooks.output?.(name, value);
    },
    setFailed(message) {
      hooks.failed?.(message);
    },
  };
}

test('run uses best-effort fallbacks and still writes output when some fetchers fail', async () => {
  const previousDisableAutorun = process.env.GITHUB_JSON_BOURNE_DISABLE_AUTORUN;
  process.env.GITHUB_JSON_BOURNE_DISABLE_AUTORUN = '1';

  const warnings = [];
  const outputs = new Map();
  const observed = {
    maxPages: null,
  };

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-json-bourne-'));
  const outputPath = path.join(outputDir, 'github.json');

  try {
    const { run } = await import('../index.js');

    await run({
      core: createCoreMock(
        {
          username: 'acme',
          token: 'test-token',
          'output-path': outputPath,
          'max-repos': '12',
          'max-activities': '30',
          'max-pages': '2',
        },
        {
          warning: (message) => warnings.push(String(message)),
          output: (name, value) => outputs.set(name, value),
        },
      ),
      fetchContributions: async () => {
        throw new Error('GraphQL down');
      },
      fetchActivity: async (_username, _token, _maxActivities, options) => {
        observed.maxPages = options?.maxPages;
        return [
          {
            type: 'commit',
            repo: 'project',
            repoUrl: 'https://github.com/acme/project',
            title: 'feat: keep going',
            url: 'https://github.com/acme/project/commit/abc123',
            date: '2026-02-21T00:00:00.000Z',
          },
        ];
      },
      fetchRepos: async () => {
        throw new Error('Repo API down');
      },
    });

    const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    assert.equal(observed.maxPages, 2);
    assert.equal(data.contributions.total, 0);
    assert.equal(data.calendar.weeks.length, 0);
    assert.equal(data.repositories.length, 0);
    assert.equal(data.recentActivity.length, 1);

    assert.match(warnings[0], /Contributions fetch failed/);
    assert.match(warnings[1], /Repository fetch failed/);

    assert.equal(outputs.get('json-path'), outputPath);
    assert.equal(typeof outputs.get('last-updated'), 'string');
    assert.notEqual(outputs.get('last-updated').length, 0);
  } finally {
    if (previousDisableAutorun == null) {
      delete process.env.GITHUB_JSON_BOURNE_DISABLE_AUTORUN;
    } else {
      process.env.GITHUB_JSON_BOURNE_DISABLE_AUTORUN = previousDisableAutorun;
    }
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
