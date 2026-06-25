#!/usr/bin/env bash
set -euo pipefail

npm run compat-check
echo "gate-compat: pi compatibility holds"
