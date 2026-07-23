# Step 3: Verify

Test isolated databases or fixtures for:

- fresh initialization;
- repeated initialization;
- supported upgrade paths;
- export without ephemeral or plaintext-secret data;
- restore of current and supported older archives;
- post-restore invariants and required credential reactivation.

Do not test destructive restore behavior against production.
