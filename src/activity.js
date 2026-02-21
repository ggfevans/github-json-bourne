import { Octokit } from '@octokit/rest';

const EVENTS_ROUTE = 'GET /users/{username}/events';
const COMPARE_ROUTE = 'GET /repos/{owner}/{repo}/compare/{basehead}';

function truncateTitle(value) {
  const firstLine = String(value ?? '').split('\n')[0].trim();
  return firstLine || 'Untitled';
}

function toMillis(value) {
  const timestamp = Date.parse(String(value ?? ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => toMillis(b.date) - toMillis(a.date));
}

function cutoffMillis(topActivities, maxActivities) {
  if (topActivities.length < maxActivities) {
    return -Infinity;
  }

  const oldestIncluded = topActivities[topActivities.length - 1];
  return toMillis(oldestIncluded?.date);
}

function addTopActivity(topActivities, seenUrls, item, maxActivities) {
  if (!item || typeof item.url !== 'string' || item.url.length === 0) {
    return;
  }

  if (typeof item.date !== 'string' || item.date.length === 0) {
    return;
  }

  if (seenUrls.has(item.url)) {
    return;
  }

  const itemTime = toMillis(item.date);
  if (topActivities.length >= maxActivities && itemTime <= cutoffMillis(topActivities, maxActivities)) {
    return;
  }

  seenUrls.add(item.url);
  topActivities.push(item);
  topActivities.sort((a, b) => toMillis(b.date) - toMillis(a.date));

  if (topActivities.length > maxActivities) {
    topActivities.pop();
  }
}

async function fetchPushCommits(octokit, event, options = {}) {
  const allowCompare = options.allowCompare !== false;
  const repoFull = event.repo?.name;
  const repo = repoFull?.split('/').pop() ?? '';
  const eventDate = event.created_at ?? new Date().toISOString();
  const payload = event.payload ?? {};
  const fallbackCommits = Array.isArray(payload.commits) ? payload.commits : [];

  if (!repoFull || !repo) {
    return [];
  }

  const itemsFromEvent = fallbackCommits
    .map((commit) => {
      const sha = String(commit.sha ?? '').trim();
      if (!sha) {
        return null;
      }

      return {
        type: 'commit',
        repo,
        repoUrl: `https://github.com/${repoFull}`,
        title: truncateTitle(commit.message),
        url: `https://github.com/${repoFull}/commit/${sha}`,
        date: eventDate,
      };
    })
    .filter(Boolean);

  if (!allowCompare || (payload.size ?? 0) <= 20) {
    return itemsFromEvent;
  }

  const [owner, repoName] = repoFull.split('/');
  const before = String(payload.before ?? '');
  const head = String(payload.head ?? '');
  const canCompare =
    Boolean(owner) &&
    Boolean(repoName) &&
    before.length > 0 &&
    head.length > 0 &&
    !/^0+$/.test(before) &&
    !/^0+$/.test(head);

  if (!canCompare) {
    return itemsFromEvent;
  }

  try {
    const response = await octokit.request(COMPARE_ROUTE, {
      owner,
      repo: repoName,
      basehead: `${before}...${head}`,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const commits = Array.isArray(response.data.commits) ? response.data.commits : [];
    if (commits.length === 0) {
      return itemsFromEvent;
    }

    return commits
      .map((commit) => {
        const sha = String(commit.sha ?? '').trim();
        const url = commit.html_url ?? (sha ? `https://github.com/${repoFull}/commit/${sha}` : '');
        if (!url) {
          return null;
        }

        return {
          type: 'commit',
          repo,
          repoUrl: `https://github.com/${repoFull}`,
          title: truncateTitle(commit.commit?.message),
          url,
          date:
            commit.commit?.author?.date ??
            commit.commit?.committer?.date ??
            eventDate,
        };
      })
      .filter(Boolean);
  } catch {
    return itemsFromEvent;
  }
}

function parsePullRequestEvent(event) {
  if (event.type !== 'PullRequestEvent' || !event.payload?.pull_request) {
    return null;
  }

  const repoFull = event.repo?.name;
  const repo = repoFull?.split('/').pop() ?? '';
  const pullRequest = event.payload.pull_request;
  const url = pullRequest.html_url;

  if (!repo || !repoFull || !url) {
    return null;
  }

  return {
    type: 'pr',
    repo,
    repoUrl: `https://github.com/${repoFull}`,
    title: truncateTitle(pullRequest.title),
    url,
    date: event.created_at,
    meta: {
      state: String(pullRequest.state ?? '').toUpperCase(),
      merged: Boolean(pullRequest.merged),
    },
  };
}

function parseIssueEvent(event) {
  if (event.type !== 'IssuesEvent' || !event.payload?.issue) {
    return null;
  }

  const repoFull = event.repo?.name;
  const repo = repoFull?.split('/').pop() ?? '';
  const issue = event.payload.issue;
  const url = issue.html_url;

  if (!repo || !repoFull || !url) {
    return null;
  }

  return {
    type: 'issue',
    repo,
    repoUrl: `https://github.com/${repoFull}`,
    title: truncateTitle(issue.title),
    url,
    date: event.created_at,
    meta: {
      state: String(issue.state ?? '').toUpperCase(),
    },
  };
}

function normalizeOptions(optionsOrClient) {
  if (!optionsOrClient) {
    return {};
  }

  if (typeof optionsOrClient.request === 'function') {
    return { octokit: optionsOrClient };
  }

  return optionsOrClient;
}

export async function fetchActivity(username, token, maxActivities = 30, optionsOrClient = null) {
  const options = normalizeOptions(optionsOrClient);
  const octokit = options.octokit ?? new Octokit({ auth: token });
  const maxPages =
    Number.isInteger(options.maxPages) && options.maxPages > 0
      ? options.maxPages
      : 3;
  const topActivities = [];
  const seenUrls = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    let batch;
    try {
      const response = await octokit.request(EVENTS_ROUTE, {
        username,
        page,
        per_page: 100,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      batch = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (page === 1) {
        throw new Error(`Failed to fetch user events: ${error.message}`);
      }
      break;
    }

    if (batch.length === 0) {
      break;
    }

    for (const event of batch) {
      const eventTime = toMillis(event?.created_at);
      const hasRoom = topActivities.length < maxActivities;
      const cutoff = cutoffMillis(topActivities, maxActivities);
      const isCompetitive = hasRoom || eventTime > cutoff;

      if (!isCompetitive) {
        continue;
      }

      if (event.type === 'PushEvent') {
        const commits = await fetchPushCommits(octokit, event, {
          allowCompare: isCompetitive,
        });

        for (const commit of commits) {
          addTopActivity(topActivities, seenUrls, commit, maxActivities);
        }
        continue;
      }

      if (event.type === 'PullRequestEvent') {
        addTopActivity(topActivities, seenUrls, parsePullRequestEvent(event), maxActivities);
        continue;
      }

      if (event.type === 'IssuesEvent') {
        addTopActivity(topActivities, seenUrls, parseIssueEvent(event), maxActivities);
      }
    }

    if (batch.length < 100) {
      break;
    }

    const cutoff = cutoffMillis(topActivities, maxActivities);
    const oldestEventTime = toMillis(batch[batch.length - 1]?.created_at);
    if (topActivities.length >= maxActivities && oldestEventTime <= cutoff) {
      break;
    }
  }

  return sortByDateDesc(topActivities).slice(0, maxActivities);
}
