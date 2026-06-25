# CI gates

loopkit has two GitHub Actions workflows:

- `.github/workflows/ci.yml` gates the repository itself: lint, tests, registry
  validation, and leak-check.
- `.github/workflows/loop-gate.yml` gates loop output: schema contracts,
  registry shape, test state, shell safety, and leak-check.

Neither workflow merges a pull request. The strongest successful outcome is a
green check plus a human checkpoint.

The branch ruleset in `.github/rulesets/loop-gate-protection.json` records the
intended protection: required checks and at least one approving human review.
