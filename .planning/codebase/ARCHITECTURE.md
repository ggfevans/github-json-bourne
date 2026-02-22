# Architecture

**Analysis Date:** 2026-02-21

## Pattern Overview

**Overall:** GitHub Actions Node.js action with layered data fetching and transformation

**Key Characteristics:**
- Modular data source pattern (contributions, activity, repositories fetched independently)
- Best-effort resilience (failures in one source don't block others)
- Single responsibility per module (fetch, transform, validate, calculate)
- Dependency injection for testability (core API, file system, GitHub clients mocked in tests)

## Layers

**Entry Point Layer:**
- Purpose: GitHub Actions integration, input parsing, orchestration
- Location: `src/index.js`
- Contains: Main `run()` function, environment variable fallbacks, output handling
- Depends on: @actions/core, all other modules via dependency injection
- Used by: GitHub Actions runtime (via `dist/index.js` bundled artifact)

**Data Fetcher Layer:**
- Purpose: Fetch data from GitHub APIs using Octokit clients
- Location: `src/contributions.js`, `src/activity.js`, `src/repos.js`
- Contains: GraphQL and REST API calls, event pagination, error handling
- Depends on: @octokit/graphql, @octokit/rest
- Used by: Entry point layer (parallelized via Promise.allSettled)

**Transformation Layer:**
- Purpose: Parse GitHub API responses into normalized output structures
- Location: Within each fetcher (mapRepo, parseIssueEvent, truncateTitle, etc.)
- Contains: Event type parsing, field mapping, data normalization
- Depends on: LANGUAGE_COLORS lookup table
- Used by: Data fetcher layer

**Calculation Layer:**
- Purpose: Derive statistics from raw data
- Location: `src/streak.js`, `src/stats.js`
- Contains: Streak calculation (current/longest), weekly/monthly statistics
- Depends on: Calendar (contribution graph) and activity data
- Used by: Entry point layer

**Validation Layer:**
- Purpose: Enforce output schema before writing
- Location: `src/schema.js`
- Contains: Type assertions, shape validation, error collection
- Depends on: None (pure validation logic)
- Used by: Entry point layer (after all transformations)

**Input Validation Layer:**
- Purpose: Parse and validate GitHub Actions inputs
- Location: `src/inputs.js`
- Contains: Positive integer parsing with strict validation
- Depends on: None (pure utility)
- Used by: Entry point layer

**Configuration Layer:**
- Purpose: Language-to-color mapping for repository display
- Location: `src/lang-colours.js`
- Contains: Static lookup table of programming languages and hex colors
- Depends on: None
- Used by: repos fetcher

## Data Flow

**Initialization:**

1. Entry point loads environment/input configuration (username, token, limits, output path)
2. Input validation layer checks max-repos, max-activities, max-pages are positive integers
3. Dependency injection defaults applied (GitHub clients, core API, fs)

**Parallel Fetch (Promise.allSettled):**

```
[Contributions Fetch] ──→ GraphQL query for contributions + calendar
[Activity Fetch]     ──→ REST paginated events, parsed into commits/PRs/issues
[Repos Fetch]        ──→ REST paginated repos (non-fork, non-archived, sorted by push)
                              ↓ (all complete or fail independently)
```

**Fallback Application:**

- Contributions failure → `{ contributions: EMPTY_CONTRIBUTIONS, calendar: { weeks: [] } }`
- Activity failure → `[]`
- Repos failure → `[]`

**Derivation:**

```
calendar (from contributions) ──→ [calculateStreak] ──→ { current, longest, today }
                                    [calculateStats] ──→ { commitsThisWeek/Month, ... }
                  ↑
         recentActivity (from fetcher)
```

**Validation & Output:**

1. Assembled data object created
2. Schema validation confirms all required keys present and typed correctly
3. Output directory created (recursive if needed)
4. JSON written as pretty-printed string with trailing newline
5. GitHub Actions outputs set (json-path, last-updated)

**State Management:**

- No persistent state (stateless action)
- All state passed through function parameters or dependency injection
- Tests override dependencies rather than modifying globals
- Single execution per workflow trigger

## Key Abstractions

**Activity Item:**
- Purpose: Unified representation of commits, pull requests, and issues
- Examples: `src/activity.js` (parsePullRequestEvent, parseIssueEvent, fetchPushCommits)
- Pattern: Type-tagged object with common fields (type, repo, title, url, date) + type-specific meta
- Union: `{ type: 'commit' | 'pr' | 'issue', ... }`

**Calendar & Contribution Day:**
- Purpose: Represent heatmap/contribution graph
- Examples: `src/contributions.js`, `src/streak.js`, `src/stats.js`
- Pattern: Nested structure weeks → days, each day has date/count/level
- Immutable: Not modified after creation

**Repository Snapshot:**
- Purpose: Summary of repository for dashboard display
- Examples: `src/repos.js` (mapRepo function)
- Pattern: Flat object with name, description, language, stars, URL, color
- Filter: Excludes forks and archived repos, sorted by push time

**GitHub API Clients:**
- Purpose: Abstract GitHub API interactions
- Pattern: Dependency-injected Octokit instances (testable)
- Clients: GraphQL client (contributions), REST client (activity, repos)

## Entry Points

**GitHub Actions Runner:**
- Location: `dist/index.js` (bundled with @vercel/ncc)
- Triggers: Workflow schedule, manual dispatch, or PR trigger
- Responsibilities: Invokes `src/index.js` run() function without overrides

**Test Execution:**
- Location: `src/__tests__/*.test.js`
- Triggers: `npm test` (node --test)
- Responsibilities: Calls run() with mocked dependencies, verifies output

**Direct Module Import:**
- Location: Any ES module importing from `src/*.js`
- Triggers: Explicit import (not used in action, but possible)
- Responsibilities: Functions are pure and composable

## Error Handling

**Strategy:** Best-effort with graceful fallbacks at the data source level, strict validation at output.

**Patterns:**

**Fetch-Level Resilience:**
- Each of the three main fetchers (contributions, activity, repos) wrapped in Promise.allSettled
- Failure of one source logs warning, uses empty compatible shape for that source
- Activity and repos pagination failures are non-fatal (breaks and returns partial results)
- First page failure is fatal (logs error, throws)

**Input Validation:**
- parsePositiveInt throws if input fails regex or safe integer check
- Action fails immediately if username or token missing
- Schema validation throws if output data violates expected structure

**API Failures:**
- GraphQL contributions failure caught, returns empty contributions and calendar
- REST activity/repos failures caught, allow graceful degradation
- Network errors and API errors both result in warnings, not failures

**Pagination Graceful Stoppage:**
- Activity: breaks early if batch has < 100 items or cutoff time exceeded
- Repos: breaks early if batch has < 100 items or target count reached
- Both support max-pages limit to bound API calls

## Cross-Cutting Concerns

**Logging:**
- Uses @actions/core.info() for progress (what was fetched)
- Uses @actions/core.warning() for recoverable failures (one source failed)
- Uses @actions/core.setFailed() for fatal errors (invalid inputs, schema violation)

**Validation:**
- Input level: parsePositiveInt validates numeric limits
- Schema level: validate() in schema.js enforces output structure before write
- No per-field validation during fetch; relies on schema validation at end

**Authentication:**
- Token passed to all three fetchers (GraphQL client headers, Octokit auth)
- Falls back to process.env.GITHUB_TOKEN, then GH_TOKEN env vars
- No token persistence; fresh client per run

**Pagination:**
- Activity: per_page=100, maxPages configurable (default 3), deduplicates by URL
- Repos: per_page=100, paginated until maxRepos reached or no more pages
- Both support early termination based on time/count cutoffs

---

*Architecture analysis: 2026-02-21*
