#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LINEAR_API_KEY:-}" ]]; then
  echo "linear-graphql: LINEAR_API_KEY is required." >&2
  exit 64
fi
for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "linear-graphql: $bin is required." >&2
    exit 127
  fi
done

query_file="${1:-}"
if [[ $# -ge 2 ]]; then
  variables="$2"
else
  variables="${LINEAR_VARIABLES:-{}}"
fi

if [[ -n "$query_file" ]]; then
  query="$(cat "$query_file")"
else
  query="$(cat)"
fi

body="$(jq -n --arg query "$query" --argjson variables "$variables" '{query:$query, variables:$variables}')"
response="$(curl -sS -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: ${LINEAR_API_KEY}" \
  --data "$body")"

errors="$(printf "%s" "$response" | jq -r '.errors // empty')"
if [[ -n "$errors" && "$errors" != "null" ]]; then
  echo "linear-graphql: GraphQL errors: $errors" >&2
  exit 1
fi

printf "%s\n" "$response"
