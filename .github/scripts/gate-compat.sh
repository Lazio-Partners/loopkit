#!/usr/bin/env bash
set -euo pipefail

npm run validate:schemas
echo "gate-compat: schema contracts hold"
