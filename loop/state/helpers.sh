#!/usr/bin/env bash
set -euo pipefail

state_dir="${LOOPKIT_STATE_DIR:-loop/state}"

state_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

state_init() {
  local dir="${1:-$state_dir}"
  mkdir -p "$dir/artifacts" "$dir/logs" "$dir/knowledge"
  if [[ ! -f "$dir/heartbeat.json" ]]; then
    state_write_heartbeat "$dir" "idle" 0 0 "${LOOPKIT_DAILY_CAP:-8}" "${LOOPKIT_MAX_CONSECUTIVE_FAILURES:-3}" 0 "null" "null"
  fi
}

state_lock() {
  local dir="${1:-$state_dir}"
  mkdir -p "$dir"
  printf "%s/.lock\n" "$dir"
}

state_with_lock() {
  local dir="$1"
  shift
  local lock
  lock="$(state_lock "$dir")"
  flock "$lock" "$@"
}

state_write_heartbeat() {
  local dir="$1"
  local status="$2"
  local last_turn="$3"
  local consecutive_failures="$4"
  local daily_cap="$5"
  local max_consecutive_failures="$6"
  local tokens_today="$7"
  local current_finding_json="$8"
  local halt_reason_json="$9"
  mkdir -p "$dir"
  node - "$dir/heartbeat.json" "$status" "$last_turn" "$consecutive_failures" "$daily_cap" "$max_consecutive_failures" "$tokens_today" "$current_finding_json" "$halt_reason_json" <<'NODE'
const [out, status, lastTurn, failures, dailyCap, maxFailures, tokens, currentFindingJson, haltReasonJson] = process.argv.slice(2);
const fs = require("node:fs");
const value = {
  schema_version: 1,
  status,
  last_turn: Number(lastTurn),
  last_heartbeat: new Date().toISOString(),
  consecutive_failures: Number(failures),
  max_consecutive_failures: Number(maxFailures),
  turns_today: Number(lastTurn),
  daily_cap: Number(dailyCap),
  tokens_today: Number(tokens),
  current_finding: JSON.parse(currentFindingJson),
  halt_reason: JSON.parse(haltReasonJson)
};
fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`);
NODE
}

heartbeat_read() {
  local dir="${1:-$state_dir}"
  cat "$dir/heartbeat.json"
}

round_next() {
  local dir="${1:-$state_dir}"
  mkdir -p "$dir/artifacts"
  local count
  count="$(find "$dir/artifacts" -name 'round-*.json' -type f | wc -l | tr -d ' ')"
  printf "%03d\n" "$((count + 1))"
}

round_write() {
  local dir="$1"
  local round="$2"
  local json_file="$3"
  mkdir -p "$dir/artifacts"
  cp "$json_file" "$dir/artifacts/round-$round.json"
}

progress_append() {
  local dir="$1"
  local text="$2"
  mkdir -p "$dir"
  printf "%s\n" "$text" >> "$dir/progress.md"
}

state_rehydrate() {
  local dir="${1:-$state_dir}"
  if [[ -f "$dir/heartbeat.json" ]]; then
    heartbeat_read "$dir"
  else
    state_init "$dir"
    heartbeat_read "$dir"
  fi
}
