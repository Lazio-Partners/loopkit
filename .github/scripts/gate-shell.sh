#!/usr/bin/env bash
set -euo pipefail

for script in loop/worktree.sh loop/loop-driver.sh loop/schedule/run-scheduled.sh loop/guards/caps.sh loop/guards/circuit-breaker.sh; do
  test -x "$script"
  bash -n "$script"
done

if grep -R --include='*.sh' --include='*.mjs' --include='*.yml' --include='*.yaml' "gh pr mer[g]e" loop .github examples >/dev/null 2>&1; then
  echo "gate-shell: merge command found; loopkit never auto-merges" >&2
  exit 1
fi

echo "gate-shell: shell entrypoints parse and no merge command is present"
