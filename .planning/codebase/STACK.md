# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**
- JavaScript (ES2020+) - All source code and tests use modern JavaScript with ES modules

## Runtime

**Environment:**
- Node.js 20.x - Specified in `action.yml` as the runtime for GitHub Actions

**Package Manager:**
- npm - Used for dependency management
- Lockfile: `package-lock.json` present (npm v9 format)

## Frameworks

**Core:**
- GitHub Actions - Container-based action platform (`action.yml` defines inputs/outputs)

**API Clients:**
- `@octokit/rest` (v21.1.1) - REST API client for GitHub
- `@octokit/graphql` (v8.2.1) - GraphQL query client for GitHub

**CI/Build:**
- `@vercel/ncc` (v0.38.3) - Bundles Node.js modules into a single .js file for GitHub Actions distribution

**Actions Framework:**
- `@actions/core` (v1.11.1) - GitHub Actions standard library for input/output/logging

## Key Dependencies

**Critical:**
- `@octokit/rest` v21.1.1 - Primary dependency for paginated REST API calls (repos, user events)
- `@octokit/graphql` v8.2.1 - GraphQL queries for contribution data and calendar
- `@actions/core` v1.11.1 - Action input/output handling and logging

**Build & Distribution:**
- `@vercel/ncc` v0.38.3 - Bundles action code into single file for distribution (outputs to `dist/index.js`)

## Configuration

**Environment:**
- `GITHUB_TOKEN` - GitHub token (PAT or workflow token) passed via environment or action input
- `GH_TOKEN` - Alternative GitHub token environment variable
- `GITHUB_REPOSITORY_OWNER` - Default username if not provided as input
- `GITHUB_JSON_BOURNE_DISABLE_AUTORUN` - Flag to disable auto-execution (set to '1' to disable)

**GitHub API:**
- API Version Header: `X-GitHub-Api-Version: 2022-11-28` - Pinned API version for all requests

## Build Configuration

**Build Process:**
- Entry point: `src/index.js`
- Output: `dist/index.js` (bundled with ncc)
- Build command: `npm run build` → `ncc build src/index.js -o dist`

**Scripts:**
- `build` - Bundles action using ncc into dist folder
- `test` - Runs tests using Node.js native test runner (`node --test src/__tests__/*.test.js`)

## Platform Requirements

**Development:**
- Node.js 20.x or compatible
- npm 9.x or later (based on package-lock.json format)
- Access to GitHub API for testing (token required)

**Production:**
- GitHub Actions environment with Node.js 20.x runtime
- GitHub token with appropriate scopes (read for public data, write for private contributions)
- Write permissions to repository for output file

---

*Stack analysis: 2026-02-21*
