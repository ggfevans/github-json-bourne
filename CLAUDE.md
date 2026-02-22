# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

GitHub JSON Bourne is a GitHub Action that aggregates a user's GitHub profile activity into structured JSON. It fetches contributions, activity heatmaps, streak calculations, recent activities, and repository data from GitHub's APIs, producing a single JSON file for dashboards and personal sites.

## Commands

```bash
npm ci                # Install dependencies (use this, not npm install)
npm test              # Run all tests (Node.js native test runner)
npm run build         # Bundle with @vercel/ncc into dist/index.js
```

Run a single test file:
```bash
node --test src/__tests__/streak.test.js
```

**Important:** `dist/index.js` is committed to the repo because GitHub Actions runs the bundled artifact. After changing any source, run `npm run build` and commit the updated `dist/`. CI verifies dist is up-to-date.

## Architecture

ES6 modules (`"type": "module"`), Node.js 20, no framework.

### Data Flow

`src/index.js` orchestrates everything via `run(overrides={})`:

1. Parses and validates inputs (`src/inputs.js`)
2. Fetches three data sources **in parallel** via `Promise.allSettled()`:
   - **Contributions + Calendar** (`src/contributions.js`) — GraphQL API
   - **Recent Activity** (`src/activity.js`) — REST Events API with pagination
   - **Repositories** (`src/repos.js`) — REST Repos API with pagination
3. Calculates derived data:
   - **Streak** (`src/streak.js`) — current/longest from calendar
   - **Stats** (`src/stats.js`) — weekly/monthly counts from calendar + activity
4. Validates output against schema (`src/schema.js`)
5. Writes JSON to disk

### Key Patterns

- **Dependency injection** — `run()` accepts overrides for all external deps (core, fs, path, fetch functions), making tests pure with no mocking libraries
- **Best-effort fallbacks** — if any data source fails, it logs a warning and substitutes an empty compatible shape rather than failing the action
- **Competitive top-N filtering** — activity pagination stops early when older events can't displace current top-N results; compare API only called for large pushes still in contention
- **Strict validation** — `schema.js` validates the full output shape with path-based error messages before writing

### Action Inputs

Defined in `action.yml`: `username`, `token`, `output-path`, `max-repos` (default 12), `max-activities` (default 30), `max-pages` (default 3).

### Supporting Files

- `src/lang-colours.js` — language name → hex colour mapping
- `docs/plans/` — design documents for feature decisions

## Testing

Tests use Node.js native `node:test` and `node:assert` — no external test runner. Tests rely on dependency injection (passing mock functions into `run()` or module functions) rather than mocking libraries. When writing tests, follow this existing pattern.

## CI

`.github/workflows/ci.yml` runs on push/PR: install → test → build → verify dist unchanged. Actions are pinned by commit SHA.
