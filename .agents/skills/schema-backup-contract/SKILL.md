---
name: schema-backup-contract
description: Keep persistent schema, migrations, versioning, backup export, restore import, and secret-handling rules aligned. Use when adding or changing tables, columns, indexes, durable records, provider settings, backup archives, restore logic, or data-retention behavior.
---

# Schema Backup Contract

Treat schema evolution and backup compatibility as one contract. A successful migration is incomplete if fresh initialization, export, restore, or secret handling diverges.

## Workflow

Progress:

- [ ] Step 1: Map persistent representations → Read [references/01-map-contract.md](references/01-map-contract.md)
- [ ] Step 2: Review migration and archive behavior → Read [references/02-review-change.md](references/02-review-change.md)
- [ ] Step 3: Prove fresh, upgrade, export, and restore paths → Read [references/03-verify.md](references/03-verify.md)

## Configuration

Read [config.toml](config.toml). Configure every schema source, version marker, backup exporter, restore importer, encrypted-settings store, and excluded runtime key family.

## Invariants

- Keep fresh-install and in-place-upgrade schemas equivalent.
- Make initialization idempotent unless the platform requires explicit ordered migrations.
- Include durable user data intentionally; exclude locks, caches, sessions, replay state, and ephemeral jobs.
- Never export provider credentials or secrets in plaintext.
- Preserve import compatibility for supported older archives.
- Require a separately authorized, verified data backup before production migration.
