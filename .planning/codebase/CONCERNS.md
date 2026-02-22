# Codebase Concerns

**Analysis Date:** 2026-02-21

## Tech Debt

**Fallback timestamp hardcoding:**
- Issue: In `src/activity.js`, when a commit event lacks a timestamp, the code defaults to using `new Date().toISOString()` as a fallback, which represents the fetch time, not the actual commit time.
- Files: `src/activity.js` line 60
- Impact: Recent activity items may have inaccurate timestamps if GitHub API events lack creation dates, particularly for large push events where commits are expanded via the compare endpoint.
- Fix approach: Store the original event date separately and prioritize it over dynamic `new Date()` calls. Consider logging warnings when timestamps are filled with defaults.

**Manual pagination logic without Octokit helpers:**
- Issue: Both `src/activity.js` and `src/repos.js` implement custom pagination loops instead of using Octokit's built-in pagination helpers.
- Files: `src/activity.js` lines 223–286, `src/repos.js` lines 21–64
- Impact: If pagination semantics change or GitHub API pagination format evolves, multiple locations need updating. Harder to maintain consistency.
- Fix approach: Consider leveraging `@octokit/plugin-paginate-rest` or Octokit's native pagination once it stabilises for GraphQL/REST boundaries.

**Silent schema type coercion:**
- Issue: Functions like `toMillis()` and `truncateTitle()` in `src/activity.js` silently convert invalid inputs rather than failing fast.
- Files: `src/activity.js` lines 6–14
- Impact: Invalid data can flow through silently (e.g., `toMillis(undefined)` returns 0, `truncateTitle(null)` returns "Untitled"). May mask upstream API contract violations.
- Fix approach: Add explicit validation earlier (during API response parsing) rather than relying on fallback conversions.

**Hardcoded GitHub API version:**
- Issue: The API version `2022-11-28` is hardcoded in multiple request headers.
- Files: `src/activity.js` line 231, `src/repos.js` line 31, `src/contributions.js` (implicit in graphql client)
- Impact: If GitHub deprecates this API version, requires coordinated updates across the codebase. No centralised configuration.
- Fix approach: Extract to a single constant at the top level or configuration file.

## Known Bugs

**Streak calculation may fail on year boundary:**
- Symptoms: When "today" is in a different calendar year than "yesterday", the streak calculation in `calculateStreak()` compares dates using string `localeCompare()`, which works correctly for ISO dates but could be ambiguous if dates are localised.
- Files: `src/streak.js` lines 7–27
- Trigger: Run the action on January 1st with contributions on December 31st.
- Workaround: The implementation currently uses ISO date strings, which sort consistently. Monitor if timezone offsets are ever introduced.

**Stats comparison using string >= on ISO timestamps:**
- Symptoms: When calendar days and activity timestamps are compared (e.g., `item.date >= weekAgoIso`), string comparison is used on ISO 8601 timestamps. This works for full ISO strings but could fail if millisecond precision differs.
- Files: `src/stats.js` lines 21–22, 26
- Trigger: Unlikely in practice, but if activity timestamps lack milliseconds and calendar dates do, comparison logic may be inconsistent.
- Workaround: Dates are consistently generated; monitor for API changes that alter precision.

## Security Considerations

**Token exposed in GraphQL client headers:**
- Risk: The GitHub token is passed directly in the GraphQL client headers in `src/contributions.js` line 42. If errors are logged or stack traces are printed, the token could leak.
- Files: `src/contributions.js` lines 40–44
- Current mitigation: Error messages in `index.js` attempt to extract only the error message, not the full error object. The `@octokit/graphql` client should handle errors safely, but full verification needed.
- Recommendations:
  - Ensure no error objects are logged directly (check that `error.message` extraction is consistent).
  - Consider adding a sanitisation function for errors that redacts token-like strings.
  - Audit `@actions/core` to confirm it doesn't expose error stack traces in logs.

**No rate limit awareness or backoff:**
- Risk: If GitHub API rate limits are exceeded, the action fails with a generic error rather than gracefully degrading or waiting.
- Files: `src/activity.js` lines 225–240, `src/repos.js` lines 23–42
- Current mitigation: The action documents best-effort fallbacks but does not actually implement backoff or retries.
- Recommendations:
  - Implement exponential backoff with Octokit's `retries` option.
  - Expose rate limit headers from Octokit responses and log remaining quota.
  - Consider adding a configuration option for retry behaviour.

**Private repository visibility depends on token scope:**
- Risk: If a user's token lacks access to private repositories or restricted contributions, the action silently returns partial data.
- Files: `src/contributions.js`, `src/repos.js`, `src/activity.js`
- Current mitigation: The README mentions this and recommends using a PAT, but the action doesn't validate token scope or warn users explicitly.
- Recommendations:
  - Query the GitHub API for token metadata (scopes) before fetching data.
  - Log an explicit warning if token appears to have limited scope.

## Performance Bottlenecks

**API compare endpoint called for every large push event:**
- Problem: For each push event with >20 commits, the action makes an additional API call to the compare endpoint to fetch expanded commit data.
- Files: `src/activity.js` lines 105–143
- Cause: The GitHub Events API truncates commit details; the compare endpoint provides the full history.
- Improvement path:
  - Cache compare responses by `owner/repo/basehead` within a single run.
  - Consider adding an option to skip commit expansion for performance-sensitive deployments.
  - Evaluate whether `payload.commits` is sufficient for most use cases (avoid the extra call).

**Calendar data processing flattens and sorts repeatedly:**
- Problem: `flattenDays()` and `sortByDate()` operations are called multiple times for the same calendar across `streak.js` and `stats.js`.
- Files: `src/streak.js` lines 7, 27, `src/stats.js` lines 31
- Cause: Each module independently flattens and sorts the calendar without caching intermediate results.
- Improvement path: Pre-flatten and pre-sort calendar data in `index.js` before passing to downstream functions.

**No pagination cutoff optimisation for activity:**
- Problem: The activity fetcher stops paginating when the cutoff timestamp is exceeded, but does not apply the cutoff during pagination (only stops fetching more pages).
- Files: `src/activity.js` lines 281–285
- Cause: Currently safe because most users have <maxActivities items, but inefficient for users with very old activity.
- Improvement path: Apply an early exit when scanning pages if the oldest event on a page is older than the cutoff.

## Fragile Areas

**Deeply nested optional chaining in API response parsing:**
- Files: `src/contributions.js` line 49, `src/activity.js` lines 147–171, `src/repos.js` lines 4–12
- Why fragile: The code relies on `?.` chains to handle missing API fields, but doesn't validate the overall shape. If GitHub's API response structure changes (e.g., `payload.pull_request` becomes `payload.pullRequest`), the code silently returns `null` and items are filtered out.
- Safe modification: Add explicit shape validation before parsing (e.g., a `validateEventPayload()` function) so breaking changes are caught immediately rather than manifesting as missing items.
- Test coverage: Tests mock Octokit responses and test specific event types, but do not test malformed or partially missing responses thoroughly.

**Event type parsing using string comparison:**
- Files: `src/activity.js` lines 146, 174, 256, 267, 272, `src/schema.js` line 87
- Why fragile: Event type detection relies on exact string matches (`event.type === 'PushEvent'`). If GitHub introduces new event types or changes naming, unrecognised events are silently dropped.
- Safe modification: Maintain a whitelist of known event types and log a warning for unrecognised types instead of silently skipping them.
- Test coverage: Tests cover the three supported event types but don't test handling of unknown types.

**Output path creation without validation:**
- Files: `src/index.js` lines 106–109
- Why fragile: The code calls `fs.mkdirSync(outputDir, { recursive: true })` without checking permissions or validating that `outputDir` is safe (e.g., not a symlink to a restricted location).
- Safe modification: Validate that the output directory is within the expected workspace and is not a symlink; fail early if creation fails.
- Test coverage: Tests use temporary directories; no tests for permission errors or invalid paths.

## Scaling Limits

**Unbounded calendar data structure:**
- Current capacity: Calendar data for ~2000 weeks (52 years of contribution history).
- Limit: JSON serialisation and transmission could hit size limits for users with very long histories.
- Scaling path: Implement windowing (e.g., include only the last N weeks of calendar data) or compress calendar representation.

**Linear search for activity deduplication:**
- Current capacity: Efficient for maxActivities ~30–100.
- Limit: The `seenUrls` Set-based deduplication is O(1) lookups, but the `addTopActivity()` sorting operation is O(n log n) per insertion.
- Scaling path: For maxActivities >1000, consider using a priority queue or sorted structure instead of sorting the entire array on each insertion.

**Page scanning with no upper bound on pages:**
- Current capacity: Limited by `maxPages` (default 3).
- Limit: If a user requests `maxPages: 1000`, the action will make 1000 API calls sequentially.
- Scaling path: Add a hard cap on `maxPages` (e.g., 10) in the action definition, or implement concurrent fetching.

## Dependencies at Risk

**@octokit/rest (v21.1.1):**
- Risk: Octokit is a core dependency; breaking changes to the client API or authentication mechanism could require significant refactoring.
- Impact: If Octokit moves to a new major version with incompatible API (e.g., async context changes), all three fetcher modules break.
- Migration plan: Set up dependency upgrade tests in CI; pin major version and evaluate upgrades before applying.

**@octokit/graphql (v8.2.1):**
- Risk: GraphQL client is separate from REST client; maintaining both introduces complexity.
- Impact: If GitHub's GraphQL schema changes or deprecates fields (e.g., `contributionCalendar`), the contributions fetch fails completely.
- Migration plan: Monitor GitHub's GraphQL API deprecation notices; set up tests that verify query structure with the actual API (not mocked) on a schedule.

**Node 20 runtime (action.yml line 42):**
- Risk: Node 20 will eventually reach end-of-life. The action is pinned to a specific major version.
- Impact: If GitHub Actions drops Node 20 support, the action becomes unmaintainable without a rebuild.
- Migration plan: Establish a policy for Node LTS version upgrades (e.g., upgrade when N-2 is reached).

## Missing Critical Features

**No retry logic for transient failures:**
- Problem: If a network error occurs mid-pagination (e.g., on page 2 of 3), the action logs a warning and returns partial data without retrying.
- Blocks: Users cannot differentiate between "this user has no recent activity" and "network error occurred".
- Impact: Repeated action runs may show inconsistent results if transient errors occur.

**No caching mechanism for repeated runs:**
- Problem: Every run fetches all data from scratch; no caching between invocations.
- Blocks: If the action is run frequently (e.g., hourly for debugging), GitHub API rate limits may be exceeded unnecessarily.
- Impact: High usage patterns are not sustainable without a PAT with high rate limits.

**No validation of GitHub token validity before fetching:**
- Problem: The action does not verify that the token is valid until the first API call fails.
- Blocks: Users may not know their token is invalid until the action fails.
- Impact: Debugging token issues requires examining logs after a failed run.

## Test Coverage Gaps

**Missing error path tests for API failures:**
- What's not tested: What happens if contributions fetch fails mid-stream (e.g., connection drops). Currently only tested end-to-end failures.
- Files: `src/__tests__/contributions.test.js`, `src/__tests__/activity.test.js`
- Risk: Silent failures in partial data scenarios (e.g., calendar fetches but contributions count doesn't).
- Priority: High — contributions are the first API call and most likely to fail mid-operation.

**Missing edge case tests for date/time handling:**
- What's not tested: Timezone edge cases (e.g., when system clock is set to UTC vs. local time, or daylight saving transitions).
- Files: `src/__tests__/stats.test.js`, `src/__tests__/streak.test.js`
- Risk: Streak calculations may differ based on system timezone, leading to inconsistent results.
- Priority: Medium — risk is low in practice due to use of ISO strings, but could manifest in certain environments.

**Missing tests for malformed API responses:**
- What's not tested: API responses with missing fields, unexpected types, or extra fields (robustness).
- Files: `src/__tests__/activity.test.js`, `src/__tests__/repos.test.js`
- Risk: If GitHub's API returns unexpected shapes, the action fails silently (items are dropped) rather than reporting an error.
- Priority: Medium — schema validation catches final output, but intermediate parsing is fragile.

**No integration tests against real GitHub API:**
- What's not tested: Interaction with actual GitHub API (all tests use mocked Octokit).
- Files: All test files
- Risk: Breaking changes in GitHub API are not caught until the action is deployed.
- Priority: Medium — could be run on a schedule or gated behind a flag.

---

*Concerns audit: 2026-02-21*
