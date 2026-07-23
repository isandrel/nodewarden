#!/usr/bin/env python3
"""Select configurable validation obligations from a Git diff."""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
import tomllib
from pathlib import Path


def matches_pattern(path: str, pattern: str) -> bool:
    return fnmatch.fnmatch(path, pattern) or (
        pattern.startswith("**/") and fnmatch.fnmatch(path, pattern[3:])
    )


def git(repo: Path, *args: str) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return [line for line in result.stdout.splitlines() if line]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--config", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    config = tomllib.loads(Path(args.config).resolve().read_text())
    if args.head:
        changed = git(repo, "diff", "--name-only", f"{args.base}...{args.head}")
    else:
        changed = git(repo, "diff", "--name-only", args.base)
        changed += git(repo, "ls-files", "--others", "--exclude-standard")
    changed = sorted(set(changed))

    matched_files: set[str] = set()
    selected = []
    for rule in config.get("rules", []):
        matches = sorted({
            path for path in changed
            if any(matches_pattern(path, pattern) for pattern in rule.get("patterns", []))
        })
        if not matches:
            continue
        matched_files.update(matches)
        selected.append({
            "name": rule["name"],
            "files": matches,
            "companions": rule.get("companions", []),
            "commands": rule.get("commands", []),
            "checks": rule.get("checks", []),
        })

    unmatched = sorted(set(changed) - matched_files)
    report = {"changed_files": changed, "selected_rules": selected, "unmatched_files": unmatched}
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        for rule in selected:
            print(f"[{rule['name']}]")
            for command in rule["commands"]:
                print(f"  command: {command}")
            for check in rule["checks"]:
                print(f"  check: {check}")
        if unmatched:
            print("[unmatched]")
            for path in unmatched:
                print(f"  {path}")
    return 2 if args.strict and unmatched else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyError, OSError, RuntimeError, tomllib.TOMLDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2)
