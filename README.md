# GitHub JSON Bourne

[![CI](https://github.com/ggfevans/github-json-bourne/actions/workflows/ci.yml/badge.svg)](https://github.com/ggfevans/github-json-bourne/actions/workflows/ci.yml)

Your GitHub profile as structured JSON. Contributions, streaks, activity, repos — one action, one file, zero fuss.

## Quick Start

```yaml
- uses: ggfevans/github-json-bourne@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

That's it. A `github.json` file appears in your repo root with your full profile data.

## What You Get

The action fetches from three GitHub API sources in parallel, then derives streak and stats:

| Source | API | Data |
|--------|-----|------|
| Contributions | GraphQL | Yearly totals, commit/PR/issue counts, contribution calendar with heatmap levels |
| Activity | REST Events | Recent commits, PRs, and issues — normalised and deduplicated |
| Repositories | REST Repos | Non-fork, non-archived repos sorted by recent push |
| _Derived_ | — | Current/longest streak, weekly/monthly commit and contribution counts |

If any source fails, the action logs a warning and falls back to an empty shape for that source. Your downstream site never breaks.

## Full Usage

```yaml
name: Fetch GitHub Data

on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Fetch profile data
        uses: ggfevans/github-json-bourne@v1
        with:
          username: ${{ github.repository_owner }}
          token: ${{ secrets.GH_PAT || secrets.GITHUB_TOKEN }}
          output-path: src/data/github.json
          max-repos: 12
          max-activities: 30
          max-pages: 3

      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/github.json
          git diff --quiet --cached || git commit -m "chore: update github data" && git push
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `username` | `${{ github.repository_owner }}` | GitHub username to fetch data for |
| `token` | `${{ github.token }}` | GitHub token ([see token guide](#token-guide)) |
| `output-path` | `github.json` | Where to write the JSON file |
| `max-repos` | `12` | Maximum repositories to include |
| `max-activities` | `30` | Maximum recent activity items |
| `max-pages` | `3` | Event API pages to scan (100 events/page) |

All numeric inputs must be positive integers. Invalid values fail the action immediately.

## Outputs

| Output | Description |
|--------|-------------|
| `json-path` | Path to the generated JSON file |
| `last-updated` | ISO timestamp of when data was fetched |

## Output Schema

<details>
<summary>Full JSON structure (click to expand)</summary>

```jsonc
{
  "lastUpdated": "2026-02-21T04:00:00.000Z",

  "contributions": {
    "total": 1247,
    "commits": 892,
    "pullRequests": 156,
    "pullRequestReviews": 89,
    "issues": 110,
    "restricted": 34           // private repo contributions
  },

  "calendar": {
    "weeks": [
      {
        "days": [
          {
            "date": "2026-02-21",
            "count": 5,
            "level": 2            // 0 = none, 1-4 = quartile intensity
          }
        ]
      }
    ]
  },

  "streak": {
    "current": 12,
    "longest": 45,
    "today": true
  },

  "recentActivity": [
    {
      "type": "commit",          // "commit" | "pr" | "issue"
      "repo": "owner/repo-name",
      "repoUrl": "https://github.com/owner/repo-name",
      "title": "fix: resolve edge case in parser",
      "url": "https://github.com/owner/repo-name/commit/abc123",
      "date": "2026-02-21T03:45:00Z",
      "meta": {
        "commitCount": 3         // commits only: push size
      }
    },
    {
      "type": "pr",
      "repo": "owner/repo-name",
      "repoUrl": "https://github.com/owner/repo-name",
      "title": "Add dark mode support",
      "url": "https://github.com/owner/repo-name/pull/42",
      "date": "2026-02-20T18:30:00Z",
      "meta": {
        "state": "open",         // PRs: "open" | "closed"
        "merged": false          // PRs only
      }
    },
    {
      "type": "issue",
      "repo": "owner/repo-name",
      "repoUrl": "https://github.com/owner/repo-name",
      "title": "Button misaligned on mobile",
      "url": "https://github.com/owner/repo-name/issues/99",
      "date": "2026-02-19T12:00:00Z",
      "meta": {
        "state": "open"          // Issues: "open" | "closed"
      }
    }
  ],

  "stats": {
    "commitsThisWeek": 14,
    "commitsThisMonth": 47,
    "contributionsThisWeek": 22,
    "contributionsThisMonth": 68,
    "repositoriesThisWeek": 3
  },

  "repositories": [
    {
      "name": "my-project",
      "description": "A cool project",
      "language": "TypeScript",
      "languageColor": "#3178c6",
      "stars": 42,
      "url": "https://github.com/owner/my-project"
    }
  ]
}
```

</details>

The output is schema-validated before writing — if GitHub changes their API shape, the action fails loudly rather than writing broken JSON.

## Token Guide

| Token type | Private contributions | Private repos | Rate limit |
|------------|----------------------|---------------|------------|
| `GITHUB_TOKEN` (default) | No | No | 1,000 req/hr |
| Personal Access Token (classic) | With `read:user` scope | With `repo` scope | 5,000 req/hr |
| Fine-grained PAT | With account permissions | With repo access | 5,000 req/hr |

**For most users:** The default `GITHUB_TOKEN` works fine. If you want private contribution counts or private repo listings, create a PAT and store it as a repository secret.

```yaml
token: ${{ secrets.GH_PAT }}  # PAT stored as repo secret
```

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  GraphQL API │     │  REST Events API │     │ REST Repos API│
│ contributions│     │  commits/PRs/    │     │  non-fork,   │
│ + calendar   │     │  issues          │     │  non-archived│
└──────┬───────┘     └────────┬─────────┘     └──────┬───────┘
       │                      │                       │
       └──────────┬───────────┴───────────────────────┘
                  │  Promise.allSettled (parallel)
                  ▼
         ┌────────────────┐
         │  Derive streak │
         │  Derive stats  │
         │  Validate      │
         │  Write JSON    │
         └────────────────┘
```

Each source is independent. If one fails, the others still produce data.

## Resilience

The action uses **best-effort fallbacks** at every level:

- **Source failure** — If contributions, activity, or repos fail entirely, the action substitutes an empty compatible shape and logs a warning
- **Pagination failure** — If a page beyond the first fails, the action stops paginating and returns partial results
- **Large push expansion** — For pushes with >20 commits, the action tries to fetch full commit details via the compare API; if that fails, it falls back to the event payload

The action only fails when:
- Required inputs are invalid
- Output file can't be written
- Final schema validation fails

## Development

```bash
npm ci              # install dependencies
npm test            # run tests (Node.js native test runner)
npm run build       # bundle into dist/index.js
```

`dist/` is committed because GitHub Actions runs the bundled artifact. After changing source, rebuild and commit the updated dist.

## License

MIT
