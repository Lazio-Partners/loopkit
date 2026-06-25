#!/usr/bin/env bash
set -euo pipefail

npm run leak-check
echo "gate-summary: leak-check clean"
