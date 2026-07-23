# Step 3: Mirror and Finalize

1. Fetch again and verify the mirror branch still equals the recorded old SHA.
2. Use fast-forward when possible.
3. When a rewrite is required, use an explicit lease:

```bash
git push --force-with-lease=refs/heads/<mirror>:<old-sha> <fork-remote> <upstream-ref>:<mirror>
```

4. Verify identical SHAs, zero divergence, and an empty tree diff.
5. Protect mirror and production branches from deletion and force-push.
6. Report backups, checksums, refs, deployment identity, smoke evidence, and unresolved limitations.

If verification fails, roll back service code when safe, preserve data stores, and do not assume code rollback reverses schema changes.
