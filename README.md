# GitHub JSON Bourne

Fetch GitHub profile activity into a single JSON file for sites and dashboards.

This action aggregates:
- contributions + calendar (GraphQL)
- recent activity (events API with commit/PR/issue normalization)
- repositories (REST, non-fork, non-archived)
- derived streak and weekly/monthly stats

## Usage

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
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `username` | No | `${{ github.repository_owner }}` | GitHub username to fetch. |
| `token` | No | `${{ github.token }}` | GitHub token (PAT recommended if you need private contribution visibility). |
| `output-path` | No | `github.json` | Output path for generated JSON. |
| `max-repos` | No | `12` | Maximum repositories to include in `repositories[]`. |
| `max-activities` | No | `30` | Maximum activity items to include in `recentActivity[]`. |
| `max-pages` | No | `3` | Maximum `/users/{username}/events` pages scanned when building activity. |

All numeric inputs are validated as strict positive integers.

## Outputs

| Name | Description |
| --- | --- |
| `json-path` | Path to generated JSON file. |
| `last-updated` | ISO timestamp used in output payload. |

## Best-Effort Behavior

The action is resilient by default:
- Each source (`contributions`, `activity`, `repositories`) is fetched independently.
- If one source fails, the action logs a warning and falls back to an empty compatible shape for that source.
- The action only fails when required inputs are invalid, output writing fails, or final schema validation fails.

This keeps downstream sites from breaking due to transient GitHub API failures.

## Output Shape

Top-level keys:
- `lastUpdated`
- `contributions`
- `calendar`
- `streak`
- `recentActivity`
- `stats`
- `repositories`

The structure is validated before write so upstream API shape changes are caught quickly.

## Development

```bash
npm ci
npm test
npm run build
```

`dist/` is committed because GitHub Actions runs the bundled artifact.
