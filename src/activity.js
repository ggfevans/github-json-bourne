import { Octokit } from '@octokit/rest';

function truncateTitle(value) {
  const firstLine = String(value ?? '').split('\n')[0].trim();
  return firstLine || 'Untitled';
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function dedupeByUrl(items) {
  const seen = new Map();
  for (const item of items) {
    if (!seen.has(item.url)) {
      seen.set(item.url, item);
    }
  }
  return [...seen.values()];
}

async function fetchPushCommits(octokit, event) {
  const repoFull = event.repo?.name;
  const repo = repoFull?.split('/').pop() ?? '';
  const eventDate = event.created_at ?? new Date().toISOString();
  const payload = event.payload ?? {};
  const fallbackCommits = Array.isArray(payload.commits) ? payload.commits : [];

  if (!repoFull || !repo) {
    return [];
  }

  const itemsFromEvent = fallbackCommits.map((commit) => ({
    type: 'commit',
    repo,
    repoUrl: `https://github.com/${repoFull}`,
    title: truncateTitle(commit.message),
    url: `https://github.com/${repoFull}/commit/${commit.sha}`,
    date: eventDate,
  }));

  if ((payload.size ?? 0) <= 20) {
    return itemsFromEvent;
  }

  const [owner, repoName] = repoFull.split('/');
  if (!owner || !repoName || !payload.before || !payload.head) {
    return itemsFromEvent;
  }

  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner,
      repo: repoName,
      basehead: `${payload.before}...${payload.head}`,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    return (response.data.commits ?? []).map((commit) => ({
      type: 'commit',
      repo,
      repoUrl: `https://github.com/${repoFull}`,
      title: truncateTitle(commit.commit?.message),
      url: commit.html_url,
      date:
        commit.commit?.author?.date ??
        commit.commit?.committer?.date ??
        eventDate,
    }));
  } catch {
    return itemsFromEvent;
  }
}

function parsePullRequestEvents(events) {
  return events
    .filter((event) => event.type === 'PullRequestEvent' && event.payload?.pull_request)
    .map((event) => ({
      type: 'pr',
      repo: event.repo?.name?.split('/').pop() ?? '',
      repoUrl: `https://github.com/${event.repo?.name ?? ''}`,
      title: truncateTitle(event.payload.pull_request.title),
      url: event.payload.pull_request.html_url,
      date: event.created_at,
      meta: {
        state: String(event.payload.pull_request.state ?? '').toUpperCase(),
        merged: Boolean(event.payload.pull_request.merged),
      },
    }))
    .filter((item) => item.repo && item.repoUrl !== 'https://github.com/' && item.url);
}

function parseIssueEvents(events) {
  return events
    .filter((event) => event.type === 'IssuesEvent' && event.payload?.issue)
    .map((event) => ({
      type: 'issue',
      repo: event.repo?.name?.split('/').pop() ?? '',
      repoUrl: `https://github.com/${event.repo?.name ?? ''}`,
      title: truncateTitle(event.payload.issue.title),
      url: event.payload.issue.html_url,
      date: event.created_at,
      meta: {
        state: String(event.payload.issue.state ?? '').toUpperCase(),
      },
    }))
    .filter((item) => item.repo && item.repoUrl !== 'https://github.com/' && item.url);
}

export async function fetchActivity(username, token, maxActivities = 30) {
  const octokit = new Octokit({ auth: token });

  const events = [];
  for (let page = 1; page <= 3; page += 1) {
    try {
      const response = await octokit.request('GET /users/{username}/events', {
        username,
        page,
        per_page: 100,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      const batch = Array.isArray(response.data) ? response.data : [];
      events.push(...batch);

      if (batch.length < 100) {
        break;
      }
    } catch (error) {
      if (page === 1) {
        throw new Error(`Failed to fetch user events: ${error.message}`);
      }
      break;
    }
  }

  const pushEvents = events.filter((event) => event.type === 'PushEvent');
  const commitLists = await Promise.all(pushEvents.map((event) => fetchPushCommits(octokit, event)));
  const commitActivities = commitLists.flat();

  const prActivities = parsePullRequestEvents(events);
  const issueActivities = parseIssueEvents(events);

  const combined = dedupeByUrl([...commitActivities, ...prActivities, ...issueActivities]);
  const sorted = sortByDateDesc(combined);

  return sorted.slice(0, maxActivities);
}
