import * as core from '@actions/core';
import fs from 'node:fs';
import path from 'node:path';
import { fetchContributions } from './contributions.js';
import { fetchActivity } from './activity.js';
import { fetchRepos } from './repos.js';
import { calculateStreak } from './streak.js';
import { calculateStats } from './stats.js';
import { validate } from './schema.js';
import { parsePositiveInt } from './inputs.js';

const EMPTY_CONTRIBUTIONS = {
  total: 0,
  commits: 0,
  pullRequests: 0,
  pullRequestReviews: 0,
  issues: 0,
  restricted: 0,
};

const EMPTY_CALENDAR = { weeks: [] };

const DEFAULT_DEPS = {
  core,
  fs,
  path,
  fetchContributions,
  fetchActivity,
  fetchRepos,
  calculateStreak,
  calculateStats,
  validate,
  parsePositiveInt,
};

export async function run(overrides = {}) {
  const deps = {
    ...DEFAULT_DEPS,
    ...overrides,
  };

  const coreApi = deps.core;
  const username = coreApi.getInput('username') || process.env.GITHUB_REPOSITORY_OWNER;
  const token = coreApi.getInput('token') || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const outputPath = coreApi.getInput('output-path') || 'github.json';
  const maxRepos = deps.parsePositiveInt(coreApi.getInput('max-repos'), 'max-repos');
  const maxActivities = deps.parsePositiveInt(coreApi.getInput('max-activities'), 'max-activities');
  const maxPages = deps.parsePositiveInt(coreApi.getInput('max-pages'), 'max-pages');

  if (!username) {
    throw new Error('A GitHub username is required.');
  }

  if (!token) {
    throw new Error('A GitHub token is required.');
  }

  coreApi.info(`Fetching GitHub data for ${username}`);
  const [contributionsResult, activityResult, reposResult] = await Promise.allSettled([
    deps.fetchContributions(username, token),
    deps.fetchActivity(username, token, maxActivities, { maxPages }),
    deps.fetchRepos(username, token, maxRepos, {
      onWarning: (message) => coreApi.warning(message),
    }),
  ]);

  const { contributions, calendar } =
    contributionsResult.status === 'fulfilled'
      ? contributionsResult.value
      : { contributions: EMPTY_CONTRIBUTIONS, calendar: EMPTY_CALENDAR };
  if (contributionsResult.status === 'rejected') {
    coreApi.warning(`Contributions fetch failed; using empty contributions. ${contributionsResult.reason?.message ?? contributionsResult.reason}`);
  }

  const recentActivity =
    activityResult.status === 'fulfilled'
      ? activityResult.value
      : [];
  if (activityResult.status === 'rejected') {
    coreApi.warning(`Activity fetch failed; using empty activity list. ${activityResult.reason?.message ?? activityResult.reason}`);
  }

  const repositories =
    reposResult.status === 'fulfilled'
      ? reposResult.value
      : [];
  if (reposResult.status === 'rejected') {
    coreApi.warning(`Repository fetch failed; using empty repositories list. ${reposResult.reason?.message ?? reposResult.reason}`);
  }

  const streak = deps.calculateStreak(calendar);
  const stats = deps.calculateStats(calendar, recentActivity);

  const data = {
    lastUpdated: new Date().toISOString(),
    contributions,
    calendar,
    streak,
    recentActivity,
    stats,
    repositories,
  };

  deps.validate(data);

  const outputDir = deps.path.dirname(outputPath);
  if (outputDir !== '.') {
    deps.fs.mkdirSync(outputDir, { recursive: true });
  }

  deps.fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  coreApi.setOutput('json-path', outputPath);
  coreApi.setOutput('last-updated', data.lastUpdated);
  coreApi.info(`Wrote ${outputPath} (${recentActivity.length} activities, ${repositories.length} repositories)`);
}

if (process.env.GITHUB_JSON_BOURNE_DISABLE_AUTORUN !== '1') {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  });
}
