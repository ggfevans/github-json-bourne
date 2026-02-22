# Coding Conventions

**Analysis Date:** 2026-02-21

## Naming Patterns

**Files:**
- Lowercase with hyphenation: `lang-colours.js`, `lang-colours.js`
- Test files suffix with `.test.js`: `inputs.test.js`, `activity.test.js`
- No TypeScript or JSDoc files

**Functions:**
- camelCase for all function names: `fetchContributions()`, `parsePositiveInt()`, `truncateTitle()`
- Prefixed with verb for clarity: `fetch*`, `calculate*`, `parse*`, `map*`, `create*`, `build*`, `assert*`
- Private helper functions in same file without export: `mapLevel()`, `mapRepo()`, `truncateTitle()`, `toMillis()`

**Variables:**
- camelCase for all variables and constants: `EMPTY_CONTRIBUTIONS`, `maxRepos`, `octokit`, `topActivities`
- UPPER_SNAKE_CASE for module-level constants only: `EMPTY_CONTRIBUTIONS`, `EMPTY_CALENDAR`, `CONTRIBUTION_LEVEL_MAP`, `LANGUAGE_COLORS`, `DEFAULT_DEPS`
- Single-letter loop variables acceptable in tight loops: `for (const key of requiredTopLevel)`, `for (const day of days)`, `for (const commit of commits)`
- Descriptive names for algorithm state: `topActivities`, `seenUrls`, `scannedPages`, `pageRequests`

**Types:**
- No TypeScript used; plain JavaScript with JSDoc comments for complex functions
- Object literal shapes documented inline or inferred from usage
- Constants containing object mappings in UPPER_SNAKE_CASE: `CONTRIBUTION_LEVEL_MAP`, `LANGUAGE_COLORS`

## Code Style

**Formatting:**
- No explicit formatter configured (no `.prettierrc`, `eslint.config.js`, etc.)
- 2-space indentation throughout
- No trailing commas in objects/arrays
- Line length varies but generally under 120 characters
- Strings use single quotes for consistency

**Linting:**
- No linter configured in codebase
- Follows standard Node.js conventions

## Import Organization

**Order:**
1. Node.js built-in modules first: `import fs from 'node:fs';`, `import path from 'node:path';`
2. Third-party packages next: `import { graphql } from '@octokit/graphql';`, `import { Octokit } from '@octokit/rest';`
3. Local module imports last: `import { fetchContributions } from './contributions.js';`

**Path Aliases:**
- No aliases configured; always use relative paths with `.js` extension: `import { validate } from './schema.js';`, `import { LANGUAGE_COLORS } from './lang-colours.js';`
- Explicit file extensions required (Node.js ESM requirement): all imports include `.js`

## Error Handling

**Patterns:**
- Throw `Error` objects with descriptive messages for validation and API failures
- Include context in error messages: `throw new Error(\`Input "${inputName}" must be a positive integer. Received: ${rawValue}\`);`
- For failed Promise.allSettled results, use best-effort fallbacks with default empty values (EMPTY_CONTRIBUTIONS, EMPTY_CALENDAR, empty arrays)
- Log warnings via callbacks rather than throwing for graceful degradation: `onWarning('message')` in `fetchRepos()`
- Silent failures for non-critical API calls: `catch (error) { return itemsFromEvent; }` in `fetchPushCommits()`
- First page failures throw; subsequent page failures warn and break: see `repos.js` pagination handling

**Error Re-throwing:**
- Wrap external errors: `catch (error) { throw new Error(\`GraphQL contributions query failed: ${error.message}\`); }`

## Logging

**Framework:** `@actions/core` for GitHub Actions context

**Patterns:**
- Info logs for progress: `coreApi.info(\`Fetching GitHub data for ${username}\`);`
- Info logs for results: `coreApi.info(\`Wrote ${outputPath} (${recentActivity.length} activities, ${repositories.length} repositories)\`);`
- Warning logs for recoverable failures: `coreApi.warning(\`Contributions fetch failed; using empty contributions. ...\`);`
- Failure logs for fatal errors: `core.setFailed(message)` in entry point
- No debug/verbose logging implemented

## Comments

**When to Comment:**
- Explain "why", not "what": See `streak.js` line 19-20 explaining why today's zero count doesn't break streak
- Clarify non-obvious algorithm logic: Comments before complex filtering in `fetchActivity()`, streak calculation logic
- Document constants: No inline comments but constants named descriptively (CONTRIBUTION_LEVEL_MAP maps GraphQL levels to numbers)

**JSDoc/TSDoc:**
- Not used; plain JavaScript without type annotations
- Function signatures are simple enough without JSDoc

## Function Design

**Size:**
- Small, focused functions under 50 lines typically
- Larger functions (50-100+ lines) break complex pagination/filtering logic (e.g., `fetchActivity()` is ~76 lines)
- No functions exceed 100 lines significantly

**Parameters:**
- Positional parameters for primary inputs: `fetchContributions(username, token)`
- Options object for optional/complex parameters: `fetchRepos(username, token, maxRepos = 12, options = {})`
- Callback functions passed in options: `onWarning` callback in `fetchRepos()`
- Dependency injection via object override: `run(overrides = {})` allows test mocking

**Return Values:**
- Single value returns (primitives, objects, arrays)
- Early returns for guard conditions and optimizations
- No null returns; use empty defaults (empty array, empty object) instead
- Throw on invalid input state

## Module Design

**Exports:**
- Single primary export per module when possible: Each module exports one main function (`fetchContributions`, `calculateStreak`, `validate`)
- Utility modules export multiple related functions: `inputs.js` exports only `parsePositiveInt()`
- Constants exported as module-level exports: `LANGUAGE_COLORS` in `lang-colours.js`

**Barrel Files:**
- Not used; each module has direct imports

## Dependency Injection

**Pattern:**
- Used extensively in `index.js` with `DEFAULT_DEPS` and override mechanism
- Allows functions to accept mocked dependencies for testing: `core`, `fs`, `path`, and all fetcher functions
- Spread pattern: `{ ...DEFAULT_DEPS, ...overrides }`
- Enables comprehensive testing without modifying source

---

*Convention analysis: 2026-02-21*
