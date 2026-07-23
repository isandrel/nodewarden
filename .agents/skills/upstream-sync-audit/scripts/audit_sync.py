#!/usr/bin/env python3
"""Produce a read-only, config-driven audit of upstream Git divergence."""

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


def run(repo: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        text=True,
        capture_output=True,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def ref_exists(repo: Path, ref: str) -> bool:
    return subprocess.run(
        ["git", "-C", str(repo), "show-ref", "--verify", "--quiet", ref],
        check=False,
    ).returncode == 0


def divergence(repo: Path, left: str, right: str) -> dict[str, int]:
    raw = run(repo, "rev-list", "--left-right", "--count", f"{left}...{right}")
    behind, ahead = (int(value) for value in raw.split())
    return {"behind": behind, "ahead": ahead}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--config", required=True)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    config_path = Path(args.config).resolve()
    config = tomllib.loads(config_path.read_text())
    git_config = config["git"]

    upstream_remote = git_config["upstream_remote"]
    fork_remote = git_config["fork_remote"]
    base_branch = git_config["base_branch"]
    upstream_ref = f"{upstream_remote}/{base_branch}"
    mirror_ref = f"{fork_remote}/{git_config['mirror_branch']}"
    production_name = git_config.get("production_branch", "").strip()
    production_ref = f"{fork_remote}/{production_name}" if production_name else ""

    if args.fetch or config.get("behavior", {}).get("fetch_by_default", False):
        for remote in dict.fromkeys([upstream_remote, fork_remote]):
            run(repo, "fetch", remote, "--prune", "--tags")

    required = [upstream_ref, mirror_ref]
    if production_ref:
        required.append(production_ref)
    missing = [
        ref for ref in required
        if not ref_exists(repo, f"refs/remotes/{ref}")
    ]
    if missing:
        raise RuntimeError(f"missing remote-tracking refs: {', '.join(missing)}")

    upstream_sha = run(repo, "rev-parse", upstream_ref)
    mirror_sha = run(repo, "rev-parse", mirror_ref)
    merge_base = run(repo, "merge-base", upstream_ref, mirror_ref)
    changed_files = run(repo, "diff", "--name-only", f"{merge_base}..{upstream_ref}").splitlines()

    classified: dict[str, list[str]] = {}
    for category in config.get("categories", []):
        matches = sorted({
            path for path in changed_files
            if any(matches_pattern(path, pattern) for pattern in category.get("patterns", []))
        })
        if matches:
            classified[category["name"]] = matches

    production = None
    conflicts = None
    if production_ref:
        production_sha = run(repo, "rev-parse", production_ref)
        production_base = run(repo, "merge-base", production_ref, upstream_ref)
        merge_preview = run(repo, "merge-tree", production_base, production_ref, upstream_ref)
        conflicts = merge_preview.count("+<<<<<<<")
        production = {
            "ref": production_ref,
            "sha": production_sha,
            "divergence": divergence(repo, upstream_ref, production_ref),
        }

    report = {
        "repository": str(repo),
        "worktree": run(repo, "status", "--short", "--branch").splitlines(),
        "upstream": {
            "ref": upstream_ref,
            "sha": upstream_sha,
            "describe": run(repo, "describe", "--tags", "--always", upstream_ref),
        },
        "mirror": {
            "ref": mirror_ref,
            "sha": mirror_sha,
            "divergence": divergence(repo, upstream_ref, mirror_ref),
        },
        "production": production,
        "merge_base": merge_base,
        "upstream_changed_files": changed_files,
        "categories": classified,
        "predicted_conflicts": conflicts,
        "fetched": bool(args.fetch or config.get("behavior", {}).get("fetch_by_default", False)),
    }

    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(f"upstream: {upstream_ref} {upstream_sha}")
        print(f"mirror: {mirror_ref} {mirror_sha} {report['mirror']['divergence']}")
        if production:
            print(f"production: {production_ref} {production['sha']} {production['divergence']}")
        print(f"changed files: {len(changed_files)}")
        print(f"predicted conflicts: {conflicts}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyError, OSError, RuntimeError, tomllib.TOMLDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2)
