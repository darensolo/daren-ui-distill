# Security policy

## Supported version

The repository is currently a local release candidate and has no supported public release.

## Security boundaries

- Source access is restricted to explicit read roots and realpath-checked paths.
- Application archives are read selectively; packaged source is never executed.
- Preview execution fails closed when the required isolation is unavailable.
- Library registration and site publication require separate persisted authorizations.
- The reference publisher writes local projections only; it never deploys to a public host.
- Telemetry is disabled.

Do not include accounts, credentials, cookies, tokens, private sessions, or unrelated user files in an evidence bundle.

## Reporting

Until a public security contact is configured, do not publish suspected vulnerabilities. Report them privately to the repository owner.
