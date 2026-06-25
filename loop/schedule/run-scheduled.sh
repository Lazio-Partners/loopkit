#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOOPKIT_SKILL="${LOOPKIT_SKILL:-/loop-discover}"
LOOPKIT_MAX_ITERATIONS="${LOOPKIT_MAX_ITERATIONS:-1}"
PI_BIN="${PI_BIN:-pi}"

usage_error() {
  echo "run-scheduled: $1" >&2
  exit 64
}

if [[ -z "${LOOPKIT_MODEL:-}" ]]; then
  usage_error "LOOPKIT_MODEL is required; set it to the pi model id this loop should use."
fi

if ! [[ "$LOOPKIT_MAX_ITERATIONS" =~ ^[1-9][0-9]*$ ]]; then
  usage_error "LOOPKIT_MAX_ITERATIONS must be a positive integer."
fi

export PI_OFFLINE=1
export PI_SKIP_VERSION_CHECK=1

stop_file="$REPO_ROOT/loop/guards/STOP"

for ((iteration = 1; iteration <= LOOPKIT_MAX_ITERATIONS; iteration += 1)); do
  if [[ -f "$stop_file" ]]; then
    echo "run-scheduled: halted: kill-switch present"
    exit 0
  fi

  resume_args=()
  if [[ -n "${LOOPKIT_SESSION:-}" ]]; then
    resume_args=(--session "$LOOPKIT_SESSION")
  elif [[ "${LOOPKIT_FRESH:-0}" == "1" && "$iteration" == "1" ]]; then
    resume_args=()
  else
    resume_args=(-c)
  fi

  argv=("$PI_BIN" -p "$LOOPKIT_SKILL" --approve --model "$LOOPKIT_MODEL")
  if [[ "${#resume_args[@]}" -gt 0 ]]; then
    argv+=("${resume_args[@]}")
  fi
  echo "run-scheduled: iteration $iteration/$LOOPKIT_MAX_ITERATIONS start: ${LOOPKIT_SKILL}"
  set +e
  "${argv[@]}"
  status=$?
  set -e
  echo "run-scheduled: iteration $iteration/$LOOPKIT_MAX_ITERATIONS exit=$status"
  if [[ "$status" -ne 0 ]]; then
    exit "$status"
  fi
done
