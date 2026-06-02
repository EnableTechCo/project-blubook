# GitHub Actions Workflows

This repository now includes a complete CI/CD and automation workflow suite.

## Workflows

- `ci.yml`: Main quality gate (lint, type-check, build, optional tests, optional e2e smoke).
- `security.yml`: CodeQL + dependency audit + secret scanning.
- `dependency-review.yml`: Blocks risky dependency changes in pull requests.
- `deploy-railway.yml`: Deploys to Railway via deploy hook on `main` pushes and manual trigger.
- `manual-ops.yml`: Run one-off operations from Actions UI (build/lint/type-check/test/e2e/healthcheck).
- `automation-greetings.yml`: Greets first-time issue and PR contributors.
- `automation-labeler.yml`: Applies PR labels based on changed files.
- `automation-stale.yml`: Marks inactive issues/PRs as stale and closes them later.
- `automation-issue-summary.yml`: Posts/updates a triage summary comment on issue create/edit.

## Required repository settings

## Branch protection

Protect `main` and require these checks:

- Continuous Integration / lint
- Continuous Integration / typecheck
- Continuous Integration / build
- Security / CodeQL Analysis
- Security / Dependency Audit
- Security / Secret Scan
- Dependency Review / dependency-review

Optional but recommended:

- Automation - Labeler / label
- Automation - Greetings / greet-first-time-contributors

## Required secrets

For deploy and health checks:

- `RAILWAY_DEPLOY_HOOK_URL`
- `APP_HEALTHCHECK_URL` (optional but recommended)

No additional secrets are required for greetings, labeler, stale, or issue summary workflows.

## Notes

- CI uses placeholder environment values so build/type-check can run even when production secrets are not exposed to pull requests.
- If you later add stable Jest/Playwright configs, tests automatically run in CI.
- If you do not want e2e or manual ops, you can remove those workflow files.
- Label mappings are configured in `.github/labeler.yml`.
