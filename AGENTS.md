# loopkit — project memory (AGENTS.md)

Auto-loaded by both **pi** and Claude Code (`CLAUDE.md` is a symlink to this file).
This is the tight summary of the **binding invariants**. The full narrative is
[`docs/contracts.md`](docs/contracts.md); the directory map is
[`docs/repo-layout.md`](docs/repo-layout.md). Read `docs/contracts.md` first.

## What loopkit is

A public, MIT toolkit that brings **loop engineering** (build the system that
prompts the agent, not line-by-line prompts) to the **pi** harness
(`earendil-works/pi`), not Claude Code. The loop is five moves: **Discovery**
(the loop finds its own work), **Handoff** (one finding → one isolated
worktree+agent), **Verification** (a *second, different-model* agent that can say
no), **Persistence** (state written outside the conversation), **Scheduling**
(external automation re-runs it).

## Binding invariants (do not violate)

1. **Join key is sacred.** `registry.id == verdict.finding_id == round.finding_id`,
   all matching `^LK-\d{4}$` (e.g. `LK-0007`).
2. **`schema_version: 1`** is present on every state/registry object (const).
3. **Generator ≠ evaluator.** The reviewer model must differ from the worker
   model (`reviewer_model != worker_model`). A driver-enforced rule.
4. **Never auto-merge.** Any advancing verdict sets
   `human_checkpoint_required: true`; a human clears the checkpoint and merges.
   CI green is necessary, not sufficient. `done` requires an `approve` verdict
   **and** a human-merged PR. The dogfood does **not** auto-merge at 0 approvals.
5. **Three independent halts.** The loop stops on any of: consecutive-failure
   ceiling, daily turn cap, or a token budget — each enforced independently.
6. **No `Skill` tool in pi.** A skill is invoked by *reading* its `SKILL.md` or
   via `/skill:<name>`. Skills live at `.pi/skills/<name>/SKILL.md`; subagents at
   `.pi/agents/<name>.md`. Do not confuse the two.
7. **Status transitions are driver-only.** A worker may never self-promote a
   finding to `approved`/`done`.
8. **pi version pin is law.** `pi-coding-agent` is pinned to `0.80.x` (no caret —
   pi's MINOR bumps are BREAKING). A bump moves only after a green
   `npm run compat-check` and a proven `examples/first-loop` run; bumping the pin
   without both is forbidden. The pin move is itself a tracked registry finding.
9. **Security: pi runs with full user permissions and NO sandbox.** Loop logic
   must never interpolate program-derived strings into a shell (no `shell=True`
   style), never rely on stdout-regex liveness/OOM detection, and must keep
   detectors as re-runnable repo-structure-aware commands — never vendor-dir greps.
10. **Verdict enum is `approve | reject | needs_changes`** (the frozen contract).
    The brief's `ESCALATE_HUMAN` maps onto `human_checkpoint_required: true` +
    `next_action: "park" | "abort"`, not a third enum value. See the reconciliation
    notes in `docs/contracts.md`.
11. **Fail loud.** A probe that cannot run is INDETERMINATE (non-zero), never a
    silent pass.
12. **No Lazio / no private specifics.** Everything in this repo is generic and
    public. No internal issue keys, hostnames, or app names.
13. **Borrow by re-implementation.** loopkit takes contract *shapes* from pi,
    loop-engineering, and openloop; it takes no runtime dependency on the borrowed
    repos. See `NOTICE` for attributions.
