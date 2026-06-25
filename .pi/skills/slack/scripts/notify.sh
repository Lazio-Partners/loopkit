#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
  echo "slack: SLACK_WEBHOOK_URL is required." >&2
  exit 64
fi
for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "slack: $bin is required." >&2
    exit 127
  fi
done

message="${SLACK_MESSAGE:-${*:-}}"
if [[ -z "$message" ]]; then
  echo "slack: message required via SLACK_MESSAGE or argv." >&2
  exit 64
fi

body="$(jq -n --arg text "$message" '{text:$text}')"
curl --fail-with-body -sS -X POST -H "Content-Type: application/json" --data "$body" "$SLACK_WEBHOOK_URL" >/dev/null
echo "slack: notification sent"
