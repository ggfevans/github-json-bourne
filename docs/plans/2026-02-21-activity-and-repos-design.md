# Activity and Repo Fetch Design

## Goals
- Support `max-repos` values above 100 (current user need: 108).
- Reduce activity API load while preserving accurate top-`N` recent activity.
- Keep behavior resilient when partial data is still useful.

## Decisions
1. Repository fetch now paginates `GET /users/{username}/repos` (`per_page=100`) until it collects `max-repos` eligible repositories (`!fork && !archived`) or there are no more pages.
2. If fewer eligible repositories exist than requested, return the partial list and emit a warning.
3. Activity fetch now computes top-`N` incrementally. It processes pages in chronological order (newest first), maintains a bounded sorted list, and skips clearly non-competitive events once a cutoff date is established.
4. For large push events (`size > 20`), compare API calls are made only when the event is still competitive for top-`N`.
5. Input parsing for integer options is strict and rejects malformed values such as `12abc`.
6. Activity pagination depth is configurable via `max-pages` (default `3`) so users can tune API cost versus coverage.

## Error Handling
- Repos/activity modules throw on first-page fetch failure.
- The action currently uses `Promise.allSettled`, so module failures become warnings and return empty partials instead of failing the whole run.
- Later-page failures return collected partial data and stop pagination.
- Compare failures fall back to payload commits.

## Test Plan
- Add unit tests for integer parsing validity and malformed input rejection.
- Add repo pagination test covering `max-repos > 100` with filtering.
- Add repo partial-result warning test.
- Add activity early-stop test to prevent unnecessary page fetches.
- Add activity compare-gating test to ensure only competitive large push events trigger compare calls.
