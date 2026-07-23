---
name: upstream-sync-audit
description: Audit an upstream Git branch before synchronizing a fork or production branch. Use when checking for upstream updates, release drift, merge conflicts, sensitive file changes, CI readiness, or whether a fork can be updated safely without modifying local branches.
---

# Upstream Sync Audit

Inspect upstream changes before proposing or performing a sync. Keep discovery read-only unless the user explicitly requests `--fetch`.

## Workflow

Progress:

- [ ] Step 1: Resolve refs and collect evidence → Read [references/01-inventory.md](references/01-inventory.md)
- [ ] Step 2: Classify risk and compatibility → Read [references/02-assess.md](references/02-assess.md)
- [ ] Step 3: Recommend a gated sync → Read [references/03-report.md](references/03-report.md)

Run all steps for a detailed review. Run Step 1 only for a quick “is upstream newer?” request.

## Configuration

Read [config.toml](config.toml). Treat every value as a default that repository instructions or the user may override. Never infer credentials, resource identifiers, production URLs, or protected-branch permissions.

Run the deterministic audit:

```bash
python scripts/audit_sync.py --repo . --config config.toml --json
```

Add `--fetch` only when remote network access and remote-tracking ref updates are authorized. The script never checks out, merges, commits, pushes, or deploys.

## Safety Rules

- Separate cached-ref findings from live-fetched findings.
- Distinguish tagged releases from untagged branch commits.
- Treat successful CI as evidence, not proof of compatibility.
- Stop before mutation when the worktree is dirty or the production effect of a push is unknown.
- Report merge-base, exact SHAs, divergence, changed-file categories, and conflict count.
