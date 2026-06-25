#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh-issues: gh is required; install GitHub CLI and authenticate it." >&2
  exit 127
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh-issues: gh is not authenticated; run gh auth login first." >&2
  exit 1
fi

label="${LOOPKIT_GH_LABEL:-loop}"
repo_args=()
if [[ -n "${LOOPKIT_GH_REPO:-}" ]]; then
  repo_args=(--repo "$LOOPKIT_GH_REPO")
fi

cmd=(gh issue list)
if [[ "${#repo_args[@]}" -gt 0 ]]; then
  cmd+=("${repo_args[@]}")
fi
cmd+=(--state open --label "$label" --json number,title,url,labels --jq '.[] | [.number, .title, .url, ([.labels[].name] | join(","))] | @tsv')
"${cmd[@]}"
