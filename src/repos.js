import { Octokit } from '@octokit/rest';
import { LANGUAGE_COLORS } from './lang-colours.js';

function mapRepo(repo) {
  return {
    name: repo.name,
    description: repo.description ?? '',
    language: repo.language ?? '',
    languageColor: LANGUAGE_COLORS[repo.language] ?? '',
    stars: Number(repo.stargazers_count ?? 0),
    url: repo.html_url,
  };
}

export async function fetchRepos(username, token, maxRepos = 12, options = {}) {
  const octokit = options.octokit ?? new Octokit({ auth: token });
  const onWarning = typeof options.onWarning === 'function' ? options.onWarning : () => {};
  const repositories = [];
  let scannedPages = 0;

  for (let page = 1; repositories.length < maxRepos; page += 1) {
    let batch;
    try {
      const response = await octokit.request('GET /users/{username}/repos', {
        username,
        sort: 'pushed',
        page,
        per_page: 100,
        type: 'owner',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      batch = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (page === 1) {
        throw new Error(`Failed to fetch repositories: ${error.message}`);
      }

      const reason = error instanceof Error ? error.message : String(error);
      onWarning(`Repository pagination stopped on page ${page}: ${reason}`);
      break;
    }

    scannedPages += 1;
    if (batch.length === 0) {
      break;
    }

    for (const repo of batch) {
      if (repo.fork || repo.archived) {
        continue;
      }

      repositories.push(mapRepo(repo));
      if (repositories.length >= maxRepos) {
        break;
      }
    }

    if (batch.length < 100) {
      break;
    }
  }

  if (repositories.length < maxRepos) {
    onWarning(
      `Requested ${maxRepos} repositories, but found ${repositories.length} eligible repositories after scanning ${scannedPages} pages.`,
    );
  }

  return repositories;
}
