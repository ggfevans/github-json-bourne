import { Octokit } from '@octokit/rest';
import { LANGUAGE_COLORS } from './lang-colours.js';

export async function fetchRepos(username, token, maxRepos = 12) {
  const octokit = new Octokit({ auth: token });

  let repos;
  try {
    const response = await octokit.request('GET /users/{username}/repos', {
      username,
      sort: 'pushed',
      per_page: 100,
      type: 'owner',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    repos = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    throw new Error(`Failed to fetch repositories: ${error.message}`);
  }

  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .slice(0, maxRepos)
    .map((repo) => ({
      name: repo.name,
      description: repo.description ?? '',
      language: repo.language ?? '',
      languageColor: LANGUAGE_COLORS[repo.language] ?? '',
      stars: Number(repo.stargazers_count ?? 0),
      url: repo.html_url,
    }));
}
