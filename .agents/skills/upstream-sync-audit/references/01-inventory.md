# Step 1: Inventory Refs

## Process

1. Read repository instructions and `config.toml`.
2. Check the worktree, remotes, protected branches, and push-triggered workflows.
3. Run `audit_sync.py` without `--fetch`.
4. If live state is required and authorized, rerun with `--fetch`.
5. Record exact SHAs, merge-base, tag description, and divergence.

## Rules

- Label cached results as cached.
- Do not switch branches or update local branch tips.
- Treat untracked files as user data until explained.

## Next

Proceed to [Step 2: Assess Changes](02-assess.md).
