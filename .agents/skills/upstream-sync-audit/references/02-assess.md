# Step 2: Assess Changes

## Process

1. Read commits from merge-base to upstream tip in chronological order.
2. Inspect every changed security, schema, persistence, deployment, and client-protocol file.
3. Check upstream CI and release state from primary sources when available.
4. Preview merge conflicts without modifying refs.
5. Identify downstream tests that are not included in the fork's aggregate test command.

## Rules

- Separate confirmed regressions, integration gaps, warnings, and pre-existing failures.
- Do not call an untagged commit a release.
- Do not assume a dependency advisory reaches production runtime; trace the dependency path.

## Next

Proceed to [Step 3: Report](03-report.md).
