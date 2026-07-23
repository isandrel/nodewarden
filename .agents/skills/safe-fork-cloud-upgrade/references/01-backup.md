# Step 1: Freeze and Back Up

1. Read repository and infrastructure instructions.
2. Record worktree state, exact refs, remotes, deployment triggers, resource bindings, routes, schedules, and secret names.
3. Create an external backup directory outside Git.
4. Run configured exports and read-only metadata commands.
5. Verify backup size, structure, restore prerequisites, and checksums.
6. Confirm every object-storage limitation and stop if complete protection is required but unavailable.
7. Push a backup branch and annotated tag that resolve to the original fork SHA.

Never commit temporary provider configuration or backup artifacts.

Proceed to [Step 2: Upgrade](02-upgrade.md).
