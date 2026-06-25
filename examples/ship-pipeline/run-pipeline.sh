#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
EXAMPLE_ROOT="${LOOPKIT_EXAMPLE_ROOT:-$SCRIPT_DIR}"

source "$EXAMPLE_ROOT/loopkit.config.sh"

export PI_OFFLINE=1
export PI_SKIP_VERSION_CHECK=1

if [[ ! -d "$LOOPKIT_TARGET_REPO/.git" ]]; then
  git -C "$LOOPKIT_TARGET_REPO" init -b main >/dev/null
  git -C "$LOOPKIT_TARGET_REPO" config user.email "loopkit@example.test"
  git -C "$LOOPKIT_TARGET_REPO" config user.name "loopkit example"
  git -C "$LOOPKIT_TARGET_REPO" add package.json src/parser.js test/parser.test.js
  git -C "$LOOPKIT_TARGET_REPO" commit -m "seed ship-pipeline sample" >/dev/null
fi

mkdir -p "$LOOPKIT_STATE_DIR/artifacts" "$LOOPKIT_STATE_DIR/logs"

bash "$REPO_ROOT/loop/loop-driver.sh" \
  --registry "$LOOPKIT_REGISTRY" \
  --state-dir "$LOOPKIT_STATE_DIR" \
  --target-repo "$LOOPKIT_TARGET_REPO" \
  --mode "$LOOPKIT_MODE" \
  --worker-patch "$LOOPKIT_WORKER_PATCH" \
  --reviewer-output "$LOOPKIT_REVIEWER_OUTPUT" \
  --test-command "$LOOPKIT_TEST_COMMAND"
