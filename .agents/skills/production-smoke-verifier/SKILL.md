---
name: production-smoke-verifier
description: Verify an existing production deployment with configurable, non-destructive HTTP, platform CLI, data-store, asset, authentication, and user-confirmation checks. Use after deployment, rollback, infrastructure changes, or incidents when production evidence is required without recreating resources or mutating user data.
---

# Production Smoke Verifier

Prove the deployed version and critical behavior without broadening authorization. Default to read-only checks.

## Workflow

Progress:

- [ ] Step 1: Resolve target identity and safety boundary → Read [references/01-prepare.md](references/01-prepare.md)
- [ ] Step 2: Run automated read-only probes → Read [references/02-probe.md](references/02-probe.md)
- [ ] Step 3: Complete authenticated user checks → Read [references/03-confirm.md](references/03-confirm.md)

## Configuration

Read [config.toml](config.toml). Supply production URLs and resource names at runtime or through an ignored local override. Never commit credentials, account identifiers, user identifiers, or private response bodies.

## Safety Rules

- Allow `GET`, `HEAD`, and `OPTIONS` by default.
- Treat registration, upload, delete, restore, rotation, and write queries as mutating.
- Require explicit authorization and unique disposable input for any write probe.
- Use platform CLI commands in read-only modes.
- Separate deployment success from authenticated application success.
- Record secrets by name only.
