<!-- Filled by a later issue: the guards issues author the per-cost detail. This is a scoped skeleton with the cost→guard map. -->

# The four costs

Unattended agent loops accrue four costs over time. loopkit names each one and maps a specific guard to it. A loop with no guard for a cost will pay it silently.

| Cost | What it is | The guard that covers it |
|------|------------|--------------------------|
| **Verification debt** | The loop ships work nothing skeptical checked. | A *different-model* reviewer + a deterministic floor (tests/baseline that must pass regardless of the reviewer). |
| **Comprehension rot** | The human stops understanding what the loop is doing. | A human checkpoint + an append-only `loop/state/progress.md` timeline. |
| **Cognitive surrender** | The human rubber-stamps because the loop "seems fine." | **Never auto-merge** — an `approve` only ever means "ready for a human to merge." |
| **Token blowout** | Cost grows without bound across turns. | A daily turn cap + per-turn token accounting (one of the three independent halts). |

Each guard is implemented in `loop/guards/` and `.pi/agents/reviewer.md`; the bodies of this doc are filled by the guards issues.
