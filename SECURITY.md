# Security policy

## Supported version

Security fixes are provided for the latest tagged release. Older releases may receive fixes at the maintainer's discretion.

## Security boundaries

- Source access is restricted to explicit read roots and realpath-checked paths.
- Application archives are read selectively; packaged source is never executed.
- Preview execution fails closed when the required isolation is unavailable.
- Library registration and site publication require separate persisted authorizations.
- The reference publisher writes local projections only; it never deploys to a public host.
- Telemetry is disabled.

Do not include accounts, credentials, cookies, tokens, private sessions, or unrelated user files in an evidence bundle.

## Reporting

Do not publish suspected vulnerabilities. Use GitHub's private vulnerability reporting for this repository. If that feature is unavailable, contact the repository owner privately through the GitHub profile rather than opening a public issue.
