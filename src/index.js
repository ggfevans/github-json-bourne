import * as core from '@actions/core';
import fs from 'node:fs';
import path from 'node:path';
import { fetchContributions } from './contributions.js';
import { fetchActivity } from './activity.js';
import { fetchRepos } from './repos.js';
import { calculateStreak } from './streak.js';
import { calculateStats } from './stats.js';
import { validate } from './schema.js';

function parsePositiveIntInput(name) {
  const raw = core.getInput(name);
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Input "${name}" must be a positive integer. Received: ${raw}`);
  }
  return value;
}

export async function run() {
  const username = core.getInput('username') || process.env.GITHUB_REPOSITORY_OWNER;
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const outputPath = core.getInput('output-path') || 'github.json';
  const maxRepos = parsePositiveIntInput('max-repos');
  const maxActivities = parsePositiveIntInput('max-activities');

  if (!username) {
    throw new Error('A GitHub username is required.');
  }

  if (!token) {
    throw new Error('A GitHub token is required.');
  }

  core.info(`Fetching GitHub data for ${username}`);

  const [{ contributions, calendar }, recentActivity, repositories] = await Promise.all([
    fetchContributions(username, token),
    fetchActivity(username, token, maxActivities),
    fetchRepos(username, token, maxRepos),
  ]);

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
