#!/usr/bin/env bash
set -euo pipefail

heartbeat="${1:-${LOOPKIT_STATE_DIR:-loop/state}/heartbeat.json}"

if [[ ! -f "$heartbeat" ]]; then
  echo "caps: heartbeat not found at $heartbeat; no cap decision possible" >&2
  exit 2
fi

node - "$heartbeat" <<'NODE'
const fs = require("node:fs");
const heartbeat = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const turns = Number(heartbeat.turns_today ?? 0);
const cap = Number(heartbeat.daily_cap ?? 0);
if (cap > 0 && turns >= cap) {
  console.error(`caps: daily cap reached (${turns}/${cap}); halt this turn`);
  process.exit(1);
}
console.log(`caps: ok (${turns}/${cap || "unbounded"})`);
NODE
