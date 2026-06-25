#!/usr/bin/env bash
set -euo pipefail

EXAMPLE_ROOT="${LOOPKIT_EXAMPLE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

export LOOPKIT_REGISTRY="${LOOPKIT_REGISTRY:-$EXAMPLE_ROOT/patterns/registry.yaml}"
export LOOPKIT_STATE_DIR="${LOOPKIT_STATE_DIR:-$EXAMPLE_ROOT/loop/state}"
export LOOPKIT_TARGET_REPO="${LOOPKIT_TARGET_REPO:-$EXAMPLE_ROOT/sample-repo}"
export LOOPKIT_TRACKER_CMD="${LOOPKIT_TRACKER_CMD:-$EXAMPLE_ROOT/seed-tracker.sh}"
export LOOPKIT_WORKER_MODEL="${LOOPKIT_WORKER_MODEL:-ship-worker-model}"
export LOOPKIT_REVIEWER_MODEL="${LOOPKIT_REVIEWER_MODEL:-ship-reviewer-model}"
export LOOPKIT_MODE="${LOOPKIT_MODE:-dry-run}"
export LOOPKIT_WORKER_PATCH="${LOOPKIT_WORKER_PATCH:-$EXAMPLE_ROOT/expected/worker-patch.diff}"
export LOOPKIT_REVIEWER_OUTPUT="${LOOPKIT_REVIEWER_OUTPUT:-$EXAMPLE_ROOT/expected/reviewer-output.txt}"
export LOOPKIT_TEST_COMMAND="${LOOPKIT_TEST_COMMAND:-npm test}"
