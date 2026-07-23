---
name: safe-fork-cloud-upgrade
description: Restructure and upgrade a customized fork while preserving existing cloud data, resources, secrets, routes, and rollback evidence. Use for backup-gated upstream adoption, moving patches to a production branch, mirroring a fork branch, or performing an in-place cloud application upgrade without resource recreation.
---

# Safe Fork Cloud Upgrade

Treat a fork restructure and cloud upgrade as one gated migration. Keep resource identity and user data unchanged unless the user explicitly authorizes a separate migration.

## Workflow

Progress:

- [ ] Step 1: Freeze state and complete backups → Read [references/01-backup.md](references/01-backup.md)
- [ ] Step 2: Rebuild, validate, and deploy the production branch → Read [references/02-upgrade.md](references/02-upgrade.md)
- [ ] Step 3: Mirror, protect, and close rollback evidence → Read [references/03-finalize.md](references/03-finalize.md)

## Configuration

Read [config.toml](config.toml). Populate environment-specific values through an ignored local override or runtime input. Keep committed defaults free of resource IDs, account IDs, production URLs, credentials, and user data.

## Hard Gates

- Complete and verify data backups before Git mutation, push, or deployment.
- Stop when a storage system cannot be completely backed up under the authorized tooling.
- Preserve the original fork tip with remote refs before rewriting a mirror branch.
- Rebuild production customization from the current upstream base; do not replay obsolete history wholesale.
- Deploy and verify the production branch before mirroring the upstream branch.
- Use an exact old-SHA lease for any non-fast-forward update.
- Never reinterpret deployment failure as authorization to recreate cloud resources.
- Never rotate secrets merely to complete an upgrade.

## Provider Adapters

Configure backup and read-only inspection commands rather than embedding a provider assumption. For Cloudflare workflows, prefer the user-selected Wrangler launcher such as `bunx wrangler`, record secret names only, and state any object-storage export limitation precisely.
