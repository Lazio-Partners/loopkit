#!/usr/bin/env bash
set -euo pipefail

npm run validate:registry
echo "gate-registry: registry validates"
