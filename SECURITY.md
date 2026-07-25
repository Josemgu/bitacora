# Security Policy

## Supported Scope

This policy currently applies to the Bitacora codebase in:

- `app/`
- `static/`
- root deployment files such as `Dockerfile`, `docker-compose.yml`, and `.github/workflows/`

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability.

Instead, report it privately to the maintainer with:

- affected file or feature
- reproduction steps
- expected impact
- logs or screenshots if they do not expose secrets
- suggested remediation if you already have one

## Response Expectations

Security reports should include enough detail to reproduce the issue locally.
The maintainer should acknowledge the report, validate the issue, and coordinate a fix before public disclosure.

## Scope Notes

- Secrets must never be committed to the repository.
- Browser-stored provider credentials and hosted-mode encrypted credentials are security-sensitive areas.
- Deployment changes that affect TLS, database roles, or provider configuration should be reviewed as security-relevant changes.