<!-- Filled by a later issue: W1-1 / the verification issue authors the reviewer procedure. STUB: frontmatter + TODO body. -->
---
name: reviewer
description: The evaluator subagent — skeptically grades the worker's output against the finding's acceptance and emits a verdict. Can say "no". Opening a PR is the most it ever does; it never merges.
tools: [read, bash]
model: PLACEHOLDER_REVIEWER_MODEL
---

# reviewer (stub)

> **Binding (generator ≠ evaluator):** the reviewer's `model` MUST differ from the worker's `model`. The `model` values above are placeholders, but they must resolve to two *different* models. A model grading its own homework is not verification — the driver rejects any verdict where `reviewer_model == worker_model`.

TODO: author the skeptical-review procedure — run the deterministic floor independently, inspect the diff against the finding's acceptance, and emit a verdict conforming to `loop/state/schema/verdict.schema.json`. An `approve` still sets `human_checkpoint_required: true`; loopkit never auto-merges.
