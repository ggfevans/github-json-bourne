# GitHub JSON Bourne — README Rewrite

## What This Is

A project to create a comprehensive, marketplace-grade README for the GitHub JSON Bourne action. The README should give someone instant understanding within 30 seconds (what it does, what the output looks like, copy-paste workflow) while also providing depth for the curious (full configuration reference, output schema, architecture notes).

## Core Value

Someone landing on the repo immediately understands what this action does, sees real output, and can integrate it into their workflow in under a minute.

## Requirements

### Validated

- ✓ GitHub Action that fetches profile data into JSON — existing
- ✓ Contributions, calendar, activity, repos, streak, stats — existing
- ✓ Configurable inputs (username, token, output-path, max-repos, max-activities, max-pages) — existing
- ✓ Best-effort fallback behaviour — existing
- ✓ Schema-validated output — existing
- ✓ Basic README with usage, inputs, outputs — existing (91 lines)

### Active

- [ ] Hero section with one-line description and badges (CI status, license, marketplace)
- [ ] Visual output example — collapsed JSON showing the real output shape with sample data
- [ ] Quick start workflow — minimal copy-paste YAML that just works
- [ ] Full configuration reference — inputs table with descriptions and defaults
- [ ] Output schema documentation — every top-level key explained with types
- [ ] Token guidance — PAT vs GITHUB_TOKEN, what scopes are needed, private contributions
- [ ] Advanced usage examples — custom output paths, high-volume configs, commit-and-push pattern
- [ ] Scannable structure — quick start for the impatient, progressive detail for the curious

### Out of Scope

- API documentation or JSDoc — this is about the README only
- Contributing guide or code of conduct — separate concern
- Changelog or release notes — separate files
- Rewriting source code or tests — documentation only

## Context

- The action is already fully functional with comprehensive test coverage
- Current README is 91 lines — functional but bare-bones (no badges, no output examples, no visual appeal)
- Target audience: developers building portfolio sites, dashboards, or personal pages who want GitHub data as JSON
- GitHub Actions marketplace discovery matters — good READMEs rank better

## Constraints

- **Content accuracy**: README must reflect current action.yml inputs/outputs exactly
- **Output shape**: JSON examples must match what schema.js validates
- **Single file**: All documentation in README.md (no separate docs site)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Comprehensive + scannable | User wants both instant understanding and depth | — Pending |
| No style reference | User has no specific README to emulate | — Pending |

---
*Last updated: 2026-02-21 after initialization*
