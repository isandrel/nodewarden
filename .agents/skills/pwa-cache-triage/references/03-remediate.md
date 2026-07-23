# Step 3: Remediate

Apply the smallest verified recovery:

1. refresh or unregister only the affected service worker;
2. clear only the relevant site caches;
3. purge a bounded CDN path when authorized;
4. rebuild and redeploy the same service when assets are inconsistent;
5. roll back code when the current service worker is defective.

Re-run the original reproduction and confirm one navigation, matching deployment assets, and no new console errors.
