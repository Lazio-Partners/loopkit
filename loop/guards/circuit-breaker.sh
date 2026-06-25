#!/usr/bin/env bash
set -euo pipefail

heartbeat="${1:-${LOOPKIT_STATE_DIR:-loop/state}/heartbeat.json}"

if [[ ! -f "$heartbeat" ]]; then
  echo "circuit-breaker: heartbeat not found at $heartbeat; no breaker decision possible" >&2
  exit 2
fi

node - "$heartbeat" <<'NODE'
const fs = require("node:fs");
const heartbeat = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const failures = Number(heartbeat.consecutive_failures ?? 0);
const max = Number(heartbeat.max_consecutive_failures ?? 1);
if (failures >= max) {
  console.error(`circuit-breaker: consecutive failure cap reached (${failures}/${max}); halt this turn`);
  process.exit(1);
}
console.log(`circuit-breaker: ok (${failures}/${max})`);
NODE
