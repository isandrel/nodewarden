---
name: change-impact-validator
description: Map a Git diff to configurable cross-file obligations, validation commands, and manual checks. Use when reviewing a pull request, preparing CI, deciding which tests to run, or preventing schema, localization, security, deployment, and persistence changes from missing required companion updates.
---

# Change Impact Validator

Turn changed paths into an explicit validation plan. Prefer repository evidence over language-wide assumptions.

## Workflow

Progress:

- [ ] Step 1: Resolve the diff → Read [references/01-resolve-diff.md](references/01-resolve-diff.md)
- [ ] Step 2: Select obligations → Read [references/02-select-checks.md](references/02-select-checks.md)
- [ ] Step 3: Execute and close evidence → Read [references/03-verify.md](references/03-verify.md)

## Configuration

Edit [config.toml](config.toml) to add repository-specific patterns, companion files, commands, and manual checks. Keep commands non-destructive by default.

Generate a plan:

```bash
python scripts/select_checks.py --repo . --config config.toml --base HEAD
```

Use `--head <revision>` for committed ranges or `--strict` to fail when a changed file matches no rule.

## Rules

- Include staged, unstaged, and untracked files when reviewing a working tree.
- Do not execute selected commands unless the user requested validation.
- Record skipped commands and known baseline failures separately.
- Require evidence for every matched obligation before calling validation complete.
