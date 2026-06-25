<!-- Filled by a later issue: the driver/state issues author the full wiring. This is the prose skeleton of the five moves + the generator≠evaluator contract. -->

# Architecture

loopkit wires the five moves of a loop turn into one driver. This doc is the prose skeleton; the deep wiring is authored alongside the driver and state issues.

## The five moves (wiring)

1. **Discovery** — a discovery pass scans sources (CI, tracker, commits, review follow-ups) and writes each unit of work as a finding in `patterns/registry.yaml` (id `LK-NNNN`). *(Wiring authored later.)*
2. **Handoff** — the driver takes one open finding, creates an isolated `git worktree` and branch (via `loop/worktree.sh`), and dispatches one **worker** subagent (`.pi/agents/worker.md`) scoped to that worktree. *(Wiring authored later.)*
3. **Verification** — a **reviewer** subagent (`.pi/agents/reviewer.md`) on a *different model* grades the worker's output against the registry's `acceptance` and emits a verdict (`loop/state/schema/verdict.schema.json`). *(Wiring authored later.)*
4. **Persistence** — every turn writes state *outside* the conversation: a compact `heartbeat.json`, an append-only `progress.md`, and an immutable `round-NNN.json` artifact, all under `loop/state/` via `loop/state/helpers.sh` (under `flock`). *(Wiring authored later.)*
5. **Scheduling** — external automation (`loop/schedule/`) re-runs the driver on a cadence; pi has no scheduler of its own. *(Wiring authored later.)*

## The generator ≠ evaluator contract

**The model that produces the work must never be the model that grades it.** The reviewer subagent's `model` MUST differ from the worker's `model`; the driver rejects any verdict where `reviewer_model == worker_model`. A model grading its own homework is not verification — it is a rubber stamp. Paired with the **never auto-merge** invariant, an `approve` verdict only ever means "ready for a human to merge."

## State on disk

State lives under `loop/state/`, written via `loop/state/helpers.sh` under `flock` so concurrent turns never corrupt it. The schemas (`verdict`, `heartbeat`, `round`) and the registry schema are frozen Tier-0 contracts — see [`docs/contracts.md`](contracts.md). *(This section's detail is authored by the state-helpers issue.)*
