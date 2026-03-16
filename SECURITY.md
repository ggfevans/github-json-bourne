# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
| < 0.1   | No        |

Only the latest release is actively supported with security fixes.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Instead, please report them through GitHub's private security advisory feature:

1. Go to the [Security Advisories page](https://github.com/ggfevans/github-json-bourne/security/advisories)
2. Click **"New draft security advisory"**
3. Fill in the details of the vulnerability

You should receive an initial response within 72 hours. If the vulnerability is confirmed, a fix will be developed privately and released as a patch before the advisory is made public.

## Scope

This action runs as a Node.js GitHub Action. It makes authenticated HTTP requests to the GitHub API and writes a JSON file to the caller's repository.

Security-relevant areas include:

- **Token handling** -- the GitHub token is passed as a secret and never logged
- **Input validation** -- all action inputs are validated before use
- **Path traversal** -- the output path is validated against the workspace
- **Dependency management** -- dependencies are bundled via ncc and audited regularly

## Out of Scope

- Vulnerabilities in the GitHub API itself
- Vulnerabilities in GitHub Actions runner infrastructure
- Issues requiring the caller to have already misconfigured their workflow permissions
