#!/usr/bin/env bash
set -euo pipefail

npm test
echo "gate-state: tests passed"
