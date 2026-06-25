#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
usage: loop/worktree.sh --branch feat/lk-0001 --worktree .worktrees/feat-lk-0001 [--repo PATH] [--base REF]

Creates or reuses one isolated git worktree for one finding. The script prints:
  WORKTREE_DIR=<absolute-path>
  BRANCH=<branch>
USAGE
}

repo="."
branch=""
worktree=""
base="HEAD"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      repo="${2:?missing value for --repo}"
      shift 2
      ;;
    --branch)
      branch="${2:?missing value for --branch}"
      shift 2
      ;;
    --worktree)
      worktree="${2:?missing value for --worktree}"
      shift 2
      ;;
    --base)
      base="${2:?missing value for --base}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "worktree: unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

if [[ -z "$branch" || -z "$worktree" ]]; then
  echo "worktree: --branch and --worktree are required" >&2
  exit 64
fi

case "$branch" in
  main|master|*/main|*/master)
    echo "worktree: refusing to create a protected branch: $branch" >&2
    exit 64
    ;;
esac

repo_root="$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$repo_root" ]]; then
  echo "worktree: --repo must point at a git repository" >&2
  exit 64
fi

git_common_dir="$(git -C "$repo_root" rev-parse --git-common-dir)"
if [[ "$worktree" = /* ]]; then
  worktree_dir="$worktree"
else
  worktree_dir="$repo_root/$worktree"
fi

mkdir -p "$(dirname "$worktree_dir")"

if [[ -d "$worktree_dir/.git" || -f "$worktree_dir/.git" ]]; then
  existing_branch="$(git -C "$worktree_dir" branch --show-current)"
  if [[ "$existing_branch" != "$branch" ]]; then
    echo "worktree: $worktree_dir already exists on branch $existing_branch, expected $branch" >&2
    exit 65
  fi
  echo "WORKTREE_DIR=$worktree_dir"
  echo "BRANCH=$branch"
  exit 0
fi

if git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
  git -C "$repo_root" fetch --prune origin >/dev/null 2>&1 || true
fi

if git -C "$repo_root" show-ref --verify --quiet "refs/heads/$branch"; then
  git -C "$repo_root" worktree add "$worktree_dir" "$branch" >/dev/null
else
  git -C "$repo_root" worktree add -b "$branch" "$worktree_dir" "$base" >/dev/null
fi

if [[ -z "$git_common_dir" ]]; then
  echo "worktree: could not resolve git common dir" >&2
  exit 65
fi

echo "WORKTREE_DIR=$worktree_dir"
echo "BRANCH=$branch"
