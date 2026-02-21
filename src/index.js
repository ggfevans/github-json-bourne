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

export async function run() {
  const username = core.getInput('username') || process.env.GITHUB_REPOSITORY_OWNER;
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const outputPath = core.getInput('output-path') || 'github.json';
  const maxRepos = parsePositiveInt(core.getInput('max-repos'), 'max-repos');
  const maxActivities = parsePositiveInt(core.getInput('max-activities'), 'max-activities');
  const maxPages = parsePositiveInt(core.getInput('max-pages'), 'max-pages');

  if (!username) {
    throw new Error('A GitHub username is required.');
  }

  if (!token) {
    throw new Error('A GitHub token is required.');
  }

  core.info(`Fetching GitHub data for ${username}`);
  const [contributionsResult, activityResult, reposResult] = await Promise.allSettled([
    fetchContributions(username, token),
    fetchActivity(username, token, maxActivities, { maxPages }),
    fetchRepos(username, token, maxRepos, {
      onWarning: (message) => core.warning(message),
    }),
  ]);

  const { contributions, calendar } =
    contributionsResult.status === 'fulfilled'
      ? contributionsResult.value
      : { contributions: EMPTY_CONTRIBUTIONS, calendar: EMPTY_CALENDAR };
  if (contributionsResult.status === 'rejected') {
    core.warning(`Contributions fetch failed; using empty contributions. ${contributionsResult.reason?.message ?? contributionsResult.reason}`);
  }

  const recentActivity =
    activityResult.status === 'fulfilled'
      ? activityResult.value
      : [];
  if (activityResult.status === 'rejected') {
    core.warning(`Activity fetch failed; using empty activity list. ${activityResult.reason?.message ?? activityResult.reason}`);
  }

  const repositories =
    reposResult.status === 'fulfilled'
      ? reposResult.value
      : [];
  if (reposResult.status === 'rejected') {
    core.warning(`Repository fetch failed; using empty repositories list. ${reposResult.reason?.message ?? reposResult.reason}`);
  }

  const streak = calculateStreak(calendar);
  const stats = calculateStats(calendar, recentActivity);

  const data = {
    lastUpdated: new Date().toISOString(),
    contributions,
    calendar,
    streak,
    recentActivity,
    stats,
    repositories,
  };

  validate(data);

  const outputDir = path.dirname(outputPath);
  if (outputDir !== '.') {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  core.setOutput('json-path', outputPath);
  core.setOutput('last-updated', data.lastUpdated);
  core.info(`Wrote ${outputPath} (${recentActivity.length} activities, ${repositories.length} repositories)`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
