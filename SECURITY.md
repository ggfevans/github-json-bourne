# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

Do not open public issues. Email the maintainer or use GitHub's private vulnerability reporting.

## Automated Security Controls

- GitHub Actions are pinned to full commit SHAs.
- Dependabot tracks GitHub Actions updates weekly (`.github/dependabot.yml`).
- CI runs ShellCheck with `severity: error` for all scripts in `scripts/`.
- CI blocks insecure shell patterns (`http://` URLs and `curl --insecure` / `curl -k`).

## Security Considerations

- Trakt Client ID is safe for logs (public API access).
- TMDB API key should be kept secret.
- Output paths are validated to stay within the workspace boundary.
- Runtime scripts are shell-based and rely only on tools available on GitHub-hosted runners (`bash`, `curl`, `jq`).
