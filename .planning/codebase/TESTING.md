# Testing Patterns

**Analysis Date:** 2026-02-21

## Test Framework

**Runner:**
- Node.js built-in `test` module (available in Node 18+)
- CLI: `node --test src/__tests__/*.test.js`
- Config: `package.json` script `"test": "node --test src/__tests__/*.test.js"`

**Assertion Library:**
- Node.js built-in `assert/strict` module
- Strict equality and type checking

**Run Commands:**
```bash
npm test                    # Run all tests in src/__tests__/*.test.js
node --test src/__tests__/*.test.js  # Direct invocation
```

No watch mode, coverage reporting, or CI integration configured.

## Test File Organization

**Location:**
- Co-located in `src/__tests__/` directory alongside source
- One test file per major module: `src/__tests__/inputs.test.js` pairs with `src/inputs.js`
- Index.js has its own test: `src/__tests__/index.test.js` (the orchestrator)

**Naming:**
- Pattern: `{module}.test.js`
- Examples: `activity.test.js`, `repos.test.js`, `schema.test.js`, `streak.test.js`, `stats.test.js`, `inputs.test.js`, `index.test.js`

**Structure:**
```
src/__tests__/
├── inputs.test.js         # Tests for parsePositiveInt()
├── schema.test.js         # Tests for validate()
├── activity.test.js       # Tests for fetchActivity()
├── repos.test.js          # Tests for fetchRepos()
├── stats.test.js          # Tests for calculateStats()
├── streak.test.js         # Tests for calculateStreak()
└── index.test.js          # Tests for run() orchestrator
```

## Test Structure

**Suite Organization:**
Tests use top-level `test()` calls directly. No nested `describe()` blocks.

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePositiveInt } from '../inputs.js';

test('accepts valid positive integers', () => {
  assert.equal(parsePositiveInt('1', 'max-repos'), 1);
  assert.equal(parsePositiveInt('108', 'max-repos'), 108);
});

test('rejects malformed integer inputs', () => {
  assert.throws(() => parsePositiveInt('', 'max-repos'), /positive integer/);
  assert.throws(() => parsePositiveInt('0', 'max-repos'), /positive integer/);
});
```

**Patterns:**

- **Setup**: Inline within test using helper functions
- **Teardown**: `finally` blocks for cleanup (see `index.test.js` temp directory cleanup)
- **Assertion**: Direct `assert.*` calls from `node:assert/strict`

Common assertions used:
- `assert.equal(actual, expected)` - Strict equality check
- `assert.deepEqual(actual, expected)` - Deep object/array comparison
- `assert.throws(() => fn(), errorPattern)` - Error throwing validation
- `assert.match(string, regexPattern)` - String pattern matching
- `assert.doesNotThrow(() => fn())` - No error thrown
- `assert.notEqual(a, b)` - Inequality check

## Mocking

**Framework:** Manual object construction (no mocking library)

**Patterns:**

Mock Octokit client (most common):
```javascript
const octokit = {
  async request(route, params) {
    if (route === 'GET /users/{username}/events') {
      if (params.page === 1) {
        return { data: events };
      }
      return { data: [] };
    }
    throw new Error(`Unexpected route: ${route}`);
  },
};

const result = await fetchActivity('acme', 'token', 30, { octokit });
```

Mock core API (GitHub Actions):
```javascript
function createCoreMock(inputs, hooks = {}) {
  return {
    getInput(name) {
      return inputs[name] ?? '';
    },
    info(message) {
      hooks.info?.(message);
    },
    warning(message) {
      hooks.warning?.(message);
    },
    setOutput(name, value) {
      hooks.output?.(name, value);
    },
    setFailed(message) {
      hooks.failed?.(message);
    },
  };
}
```

Mock factory functions for test data:
```javascript
function buildRepo(id, options = {}) {
  const suffix = options.fork ? `fork-${id}` : `${id}`;
  return {
    name: `repo-${suffix}`,
    description: options.description ?? null,
    language: options.language ?? 'JavaScript',
    stargazers_count: options.stars ?? id,
    html_url: `https://github.com/acme/repo-${suffix}`,
    fork: Boolean(options.fork),
    archived: Boolean(options.archived),
  };
}
```

**What to Mock:**
- External API clients (Octokit, GraphQL)
- GitHub Actions core API
- Filesystem operations in integration tests (use temp directories)
- Option callbacks (`onWarning`)

**What NOT to Mock:**
- Core business logic functions like `calculateStats()`, `calculateStreak()`
- Schema validation (`validate()`)
- Input parsing (`parsePositiveInt()`)
- Pure utility functions

## Fixtures and Factories

**Test Data:**

Helper functions to generate consistent test data:
```javascript
function buildValidData() {
  return {
    lastUpdated: new Date().toISOString(),
    contributions: { /* ... */ },
    calendar: { weeks: [ /* ... */ ] },
    // ... all required fields
  };
}

// Clone and modify for specific test
const data = buildValidData();
delete data.stats;  // Test missing key
```

Time-based fixtures:
```javascript
const HOUR_MS = 3600000;
function isoHoursAgo(hoursAgo) {
  return new Date(Date.now() - hoursAgo * HOUR_MS).toISOString();
}

function issueEvent(id, hoursAgo) {
  return {
    type: 'IssuesEvent',
    created_at: isoHoursAgo(hoursAgo),
    repo: { name: 'acme/project' },
    payload: { /* ... */ },
  };
}
```

**Location:**
- Helpers defined at top of test file after imports
- Helper functions prefixed with descriptive names: `buildValidData()`, `buildRepo()`, `isoHoursAgo()`, `issueEvent()`, `pushEvent()`, `createOctokit()`
- Multiple factories in same test for different entity types

## Coverage

**Requirements:** None enforced

**View Coverage:** Not implemented

No coverage metrics configured or reported.

## Test Types

**Unit Tests:**
- Scope: Single function in isolation
- Approach: Pure functions with known inputs/outputs
- Examples: `inputs.test.js` (tests `parsePositiveInt()`), `schema.test.js` (tests `validate()`), `streak.test.js` (tests `calculateStreak()`)
- Use: Direct function calls with assertions

**Integration Tests:**
- Scope: Function with mocked external dependencies
- Approach: Verify correct orchestration and API call handling
- Examples: `activity.test.js` (tests `fetchActivity()` with mocked Octokit), `repos.test.js` (tests `fetchRepos()` with mocked Octokit)
- Use: Mock clients passed via options object

**E2E Tests:**
- Framework: Built-in test module with filesystem integration
- Example: `index.test.js` - Full run orchestration test
- Approach: Create temp directory, write file system, verify output
- Use: Tests the complete pipeline with mocked fetchers but real file I/O

## Common Patterns

**Async Testing:**

Tests using async/await:
```javascript
test('uses best-effort fallbacks when some fetchers fail', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-json-bourne-'));
  const outputPath = path.join(outputDir, 'github.json');

  try {
    const { run } = await import('../index.js');
    await run({
      core: createCoreMock({ /* ... */ }),
      fetchContributions: async () => { throw new Error('GraphQL down'); },
      fetchActivity: async () => { /* ... */ },
      fetchRepos: async () => { throw new Error('Repo API down'); },
    });

    const data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(data.contributions.total, 0);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
```

Key points:
- Declare `async () => {}` test function
- `await` on async operations
- Cleanup in `finally` block

**Error Testing:**

Throw validation:
```javascript
test('rejects malformed integer inputs', () => {
  assert.throws(() => parsePositiveInt('', 'max-repos'), /positive integer/);
  assert.throws(() => parsePositiveInt('0', 'max-repos'), /positive integer/);
});
```

Pattern matching on error messages:
```javascript
assert.match(warnings[0], /Contributions fetch failed/);
```

Error recovery testing:
```javascript
test('falls back to event commits when compare request fails', async () => {
  const events = [ /* ... */ ];
  const activity = await fetchActivity(
    'acme',
    'token',
    30,
    createOctokit({ events, compareThrows: true }),
  );

  assert.equal(activity.length, 1);
  assert.equal(activity[0].title, 'fallback message');
});
```

**Pagination Testing:**

Verify API calls and state:
```javascript
test('paginates beyond 100 and counts only eligible repositories', async () => {
  const requestedPages = [];
  const octokit = {
    async request(route, params) {
      requestedPages.push(params.page);
      if (params.page === 1) return { data: pageOne };
      if (params.page === 2) return { data: pageTwo };
      return { data: [] };
    },
  };

  const repositories = await fetchRepos('acme', 'token', 108, { octokit });

  assert.equal(repositories.length, 108);
  assert.deepEqual(requestedPages, [1, 2]);
});
```

**Early Exit Testing:**

Verify functions stop making requests when conditions are met:
```javascript
test('stops fetching additional pages when older pages cannot change top N', async () => {
  const pageRequests = [];
  const octokit = {
    async request(route, params) {
      pageRequests.push(params.page);
      if (params.page === 1) return { data: eventsPageOne };
      return { data: [] };
    },
  };

  const result = await fetchActivity('acme', 'token', 2, { octokit, maxPages: 3 });

  assert.equal(result.length, 2);
  assert.deepEqual(pageRequests, [1]);  // Only page 1 requested
});
```

---

*Testing analysis: 2026-02-21*
