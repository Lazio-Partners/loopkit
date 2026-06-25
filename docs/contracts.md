# loopkit contracts (Tier-0, frozen)

This is the **canonical, self-contained** contract narrative. A `/build` agent with
**zero conversation memory** should be able to read this file alone and implement
any downstream loopkit component correctly against a stable, validated interface.

Everything here is **frozen**. The machine-readable schemas live alongside this doc:

| Contract  | Schema file                                  | Fixtures |
|-----------|----------------------------------------------|----------|
| Verdict   | `loop/state/schema/verdict.schema.json`      | `fixtures/verdict.valid.json`, `fixtures/verdict.invalid.json` |
| Heartbeat | `loop/state/schema/heartbeat.schema.json`    | `fixtures/heartbeat.valid.json` |
| Round     | `loop/state/schema/round.schema.json`        | `fixtures/round.valid.json` |
| Registry  | `patterns/registry.schema.json`              | `patterns/registry.example.yaml` |

Validate everything with `npm run validate:schemas`. Check the pi pin with
`npm run compat-check`. `npm test` runs both the schema validator and the
compat-check unit test.

---

## 1. The five moves (and the two centerpieces)

loopkit brings **loop engineering** — building the *system* that prompts the agent,
not line-by-line prompts — to the **pi** harness (`earendil-works/pi`), not Claude
Code. The loop is five moves:

1. **Discovery** — the loop finds its own work (CI failures, tracker items, commits,
   review follow-ups) and writes each as a registry finding.
2. **Handoff** — one finding → one isolated worktree + one worker agent.
3. **Verification** — a **second, different-model** reviewer agent that can say *no*.
4. **Persistence** — state written **outside** the conversation (heartbeat, progress,
   per-turn round artifacts).
5. **Scheduling** — external automation re-runs the loop on a cadence.

Two invariants are the centerpieces and govern everything else:

- **Generator ≠ evaluator.** The reviewer model must differ from the worker model.
  A model grading its own work is not verification.
- **Never auto-merge.** Any advancing verdict requires a human checkpoint. CI green
  is *necessary, not sufficient*. `done` requires an `approve` verdict **and** a
  human-merged PR.

loopkit is opinionated about ship discipline and **the four costs**: verification
debt, comprehension rot, cognitive surrender, and token blowout. It owns pi's two
weakest spots: **safe scheduling** and the **four-costs guards**.

---

## 2. Verdict schema

The reviewer's single machine-read output for one finding. Required top-level fields
(`additionalProperties: false`):

| Field                       | Type / constraint                                            |
|-----------------------------|--------------------------------------------------------------|
| `schema_version`            | `const 1`                                                    |
| `finding_id`                | string, `^LK-\d{4}$` (the join key)                          |
| `verdict`                   | enum `approve` \| `reject` \| `needs_changes`                |
| `confidence`                | number `0..1`                                                |
| `reviewer_model`            | string                                                       |
| `worker_model`              | string                                                       |
| `checks`                    | object: `tests`, `baseline`, `app_drive` — each `{ran, passed, summary?}` |
| `findings`                  | object: `good[]`, `bad[]`, `ugly[]`, `tests[]` (string arrays)|
| `blocking_reasons`          | string[]                                                     |
| `human_checkpoint_required` | boolean                                                      |
| `next_action`               | enum `open_pr` \| `return_to_worker` \| `park` \| `abort`    |
| `evidence`                  | array of `{kind, path?, ref?}` (may be empty)               |

### Driver enforcement (hard contract — NOT expressible as pure JSON Schema)

The JSON Schema encodes *structure only*. These four cross-field rules are
**enforced by the driver** (the driver issue implements them). They are documented
here so the driver author implements them and so reviewers know the real contract:

1. **Generator ≠ evaluator:** reject any verdict where `reviewer_model == worker_model`.
2. **Confidence/findings downgrade:** an `approve` with `confidence < 0.5`, or with a
   non-empty `findings.bad`, is **downgraded** (it is not a real approve).
3. **Approve still checkpoints:** an `approve` still sets
   `human_checkpoint_required: true` and `next_action: "open_pr"` — approval opens a
   PR, it does not merge.
4. **Behavioral claims need evidence:** any behavioral claim in `findings.good[]`
   must be backed by a corresponding `evidence[]` entry.

---

## 3. State files + on-disk layout + hardening mandate

The on-disk loop-state layout is borrowed **by re-implementation** from `openloop`
(Apache-2.0; its NOTICE is preserved in our `NOTICE`):

| Path                                   | Schema / format                  | Lifecycle |
|----------------------------------------|----------------------------------|-----------|
| `loop/state/heartbeat.json`            | `heartbeat.schema.json`          | overwritten each turn (compact machine state) |
| `loop/state/progress.md`               | convention (below), no schema    | append-only human timeline |
| `loop/state/artifacts/round-NNN.json`  | `round.schema.json`              | immutable per-turn report |
| `loop/state/logs/`                     | free-form                        | per-run logs |
| `loop/state/knowledge/`                | free-form                        | accumulated knowledge |

### `heartbeat.schema.json` fields (`additionalProperties: false`)

`schema_version` (const 1); `status` (`idle`\|`running`\|`blocked`\|`halted`);
`last_turn` (int); `last_heartbeat` (date-time); `consecutive_failures` (int ≥0);
`max_consecutive_failures` (int ≥1); `turns_today` (int ≥0); `daily_cap` (int ≥1);
`tokens_today` (int ≥0); `current_finding` (`^LK-\d{4}$` or null); `halt_reason`
(string or null).

### `round.schema.json` fields (`additionalProperties: false`)

`schema_version` (const 1); `round` (int); `finding_id` (`^LK-\d{4}$`);
`started_at`/`ended_at` (date-time); `worktree`; `branch`; `worker`
(`{model, tools_allowed[], tokens, stop_reason}`); `reviewer`
(`{model, tokens, stop_reason}`); `verdict` (**`$ref` to `verdict.schema.json`** —
the embedded verdict is a full valid verdict object); `outcome`
(`approve`\|`reject`\|`needs_changes`\|`error`); `caps`
(`{tokens_turn, duration_s, hit_cap}`); `guard_events[]`; `error` (string or null).

### `progress.md` convention (free-form; enforced by the helpers issue)

Per-turn, append a block headed:

```
## Round NNN — <iso8601> — LK-NNNN — <outcome>
```

### Hardening mandate (security — the helpers issue MUST honor this)

openloop has bugs loopkit must **not** copy. We take only the *schema shape*:

- **No `shell=True` style interpolation** of program-derived strings (openloop
  interpolates a `last_error` into a shell command — that is an injection). Use
  env-only or `shlex`/argv-safe handling.
- **No stdout-regex liveness/OOM detection** (gameable). openloop's stall detection
  is dead code and its OOM check is a stdout regex — do not reproduce either.
- pi runs with **full user permissions and no sandbox** (see §7); treat every
  program-derived string as untrusted input to the shell.

---

## 4. Registry schema + join key + driver-only transitions

The work registry (`patterns/registry.yaml`) is borrowed **by re-implementation**
from `loop-engineering` (MIT), forked clean of its footguns. Top level:
`schema_version` (const 1) + `findings[]`.

### Required finding fields (the frozen 11; `additionalProperties: false`)

| Field         | Type / constraint |
|---------------|-------------------|
| `id`          | `^LK-\d{4}$` — **the universal join key** |
| `title`       | string |
| `source`      | enum `ci`\|`issue_tracker`\|`commit`\|`review_followup`\|`manual` |
| `source_ref`  | string |
| `status`      | enum `open`\|`in_progress`\|`in_review`\|`needs_changes`\|`approved`\|`parked`\|`done`\|`wontfix` |
| `priority`    | enum `p0`\|`p1`\|`p2`\|`p3` |
| `isolation`   | object `{branch, worktree}` |
| `acceptance`  | string |
| `detector`    | string — a **re-runnable, repo-structure-aware command**, never a vendor-dir grep |
| `created_at`  | date-time |
| `updated_at`  | date-time |

### Optional extension fields (the additive 7 + 3 nullable)

`assigned_turn` (int\|null), `verdict_round` (int\|null), `notes` (string),
`cadence` (string), `risk` (`low`\|`medium`\|`high`), `tools` (string[]),
`skills` (string[]), `human_gates` (string[]),
`week_one_mode` (`dry_run`\|`live`),
`token_cost` (`{mode: noop|report|action, daily_cap: int, early_exit_required: bool}`).

### Detector contract

The `detector` is a **forked-clean** improvement over loop-engineering, whose
detector greps for agent-vendor directories (e.g. `.claude`, `.grok`, and similar
per-harness config dirs) — gameable and vendor-specific. loopkit's detector must be
a re-runnable command that probes the real repo/pi structure (e.g.
`node tools/validate-schemas.mjs`).

### Join key + transitions (sacred)

- **Join key:** `registry.id == verdict.finding_id == round.finding_id`. The same
  `^LK-\d{4}$` pattern is enforced identically in all three schemas.
- **Driver-only transitions:** a worker may **not** self-promote a finding to
  `approved`/`done`. Status changes are the driver's job.
- **`done` requires** an `approve` verdict **and** a cleared human checkpoint
  (human-merged PR). The dogfood does **not** auto-merge at zero approvals.

---

## 5. pi version policy + compat-check + churn doctrine

pi's own `AGENTS.md` declares **MINOR bumps are BREAKING** and there are no major
releases. A `0.80 → 0.81` bump can break the subagent example, `--mode json` output
shape, hook signatures, or skill-discovery paths loopkit depends on. **SemVer caret
ranges are unsafe.**

- **Pin:** `package.json` pins **`pi-coding-agent`** to the literal string
  `0.80.x` (patch allowed, **minor forbidden**, no `^`/`~`). pi ships four packages
  (`pi-ai`, `pi-agent-core`, `pi-coding-agent`, `pi-tui`); we pin
  **`pi-coding-agent`** (the CLI + SDK). The pin lives under
  **`optionalDependencies`**, not `dependencies`, for two reasons: (1) pi is the
  *harness*, installed separately (e.g. via Homebrew) — loopkit takes **no runtime
  dependency** on pi (see `NOTICE`); (2) it lets `npm install` succeed even while
  the `0.80.x` line is unpublished on npm, without weakening the pin — the literal
  `0.80.x` string is still the single source of truth the compat-check reads and
  greps assert. A hard `dependencies` entry would fail `npm install` against an
  unpublished version *and* misstate the dependency relationship.
- **Gate:** `tools/compat-check.mjs` asserts the installed pi's `MAJOR.MINOR`
  equals the pinned `0.80`. **On mismatch it HARD FAILS** (exit non-zero) with:
  *"loopkit is pinned to pi 0.80.x; you have &lt;X&gt;. Pin or update loopkit, do
  not run untested."*
- **Four load-bearing surface probes** (structural, run offline under
  `PI_OFFLINE=1 PI_SKIP_VERSION_CHECK=1`, no network, no API key):
  (a) `pi --mode json` single-shot result surface; (b) the subagent contract
  (own `--model` + `--tools` allowlist flags); (c) skill discovery reads `.pi/skills`
  (`--skill`); (d) the `tool_call` hook can block via `{block:true, reason}`
  (extension/hook surface). A probe that genuinely cannot run offline
  **skips-with-a-loud-warning and makes the result INDETERMINATE (non-zero)** —
  never a silent pass.
- **Clean startup:** the probes set `PI_OFFLINE=1` and `PI_SKIP_VERSION_CHECK=1` so
  pi's self-update nag never blocks — but **loopkit's own gate is never skipped**.

### Proven pi version

This spine's schemas and tooling were authored and validated against **pi 0.80.x**
(the pinned line). The compat-check prints the pinned-vs-installed version on every
run; consumers must run `npm run compat-check` against their installed pi and treat
a non-zero exit as a stop. (At the time of authoring W0-0 on the developer machine,
the locally installed pi was on the `0.79.x` line, so the live compat-check
**correctly HARD-FAILED** — that is the gate working as designed, not a defect.)

### Churn doctrine (documented, not automated here)

A pi bump is a tracked registry finding (`source: manual`). The pin moves **only
after** a green compat-check **and** a proven `examples/first-loop` run. Bumping the
pin without both is forbidden.

---

## 6. Repo layout

See `docs/repo-layout.md` for the full frozen tree. Load-bearing points: skills live
at `.pi/skills/<name>/SKILL.md` (read or run via `/skill:<name>` — **no `Skill`
tool**), subagents at `.pi/agents/<name>.md`; `settings.skills` may also point at
other Agent-Skills-standard skill dirs (e.g. `~/.claude/skills`) so one skill
definition runs on pi and other compatible harnesses.

---

## 7. Reconciliation notes (load-bearing — read before implementing downstream)

The original W0-0 *brief text* and the **frozen Tier-0 contracts** differ in two
places. The frozen contract wins; both decisions are recorded here so downstream
authors are never whipsawed.

### 7.1 Verdict enum

- **Brief text said:** verdict enum is `APPROVE | REJECT | ESCALATE_HUMAN`.
- **Frozen contract says (and wins):** `approve | reject | needs_changes`.
- **Mapping:** the brief's `ESCALATE_HUMAN` intent is expressed in the frozen model
  by `human_checkpoint_required: true` (always true on any advancing verdict) plus
  `next_action: "park"` or `"abort"` — **not** a third verdict enum value.

### 7.2 Registry optional fields

- **Brief text listed extra registry fields:** `cadence`, `risk`, `tools`, `skills`,
  `human_gates`, `week_one_mode`, and `token_cost {mode: noop|report|action,
  daily_cap, early_exit_required}`.
- **Decision:** these do **not** contradict the frozen 11 required fields and they
  encode real value (the noop/report/action token-cost model, week-one dry-run mode,
  per-pattern human gates). They are folded in as **OPTIONAL additive fields**. The
  frozen **11 fields are required**; these **7 (+3 nullable) are optional**.
  `additionalProperties: false` on each finding so typos fail CI.

---

## 8. Binding invariants checklist (notes for authors)

1. **Join key is sacred:** `registry.id == verdict.finding_id == round.finding_id`,
   all `^LK-\d{4}$`.
2. **`schema_version: 1`** (const) on every state/registry object.
3. **Generator ≠ evaluator:** `reviewer_model != worker_model`.
4. **Never auto-merge:** advancing verdict ⇒ `human_checkpoint_required: true`;
   a human merges. CI green ≠ sufficient.
5. **`done`** requires `approve` **and** a human-merged PR.
6. **Three independent halts:** consecutive-failure ceiling, daily turn cap, token
   budget — each enforced independently.
7. **Driver-only transitions:** a worker never self-promotes to `approved`/`done`.
8. **No `Skill` tool in pi:** skills are read or run via `/skill:<name>`; skills at
   `.pi/skills/<name>/SKILL.md`, agents at `.pi/agents/<name>.md`.
9. **pi pin is law:** `0.80.x`, no caret; bump only after green compat-check + proven
   first-loop; the bump is itself a tracked finding.
10. **Security:** pi runs with full user permissions and no sandbox — no `shell=True`
    interpolation, no stdout-regex liveness/OOM, detectors are repo-structure-aware
    commands not vendor-dir greps.
11. **Fail loud:** an unrunnable probe is INDETERMINATE (non-zero), never a silent
    pass.
12. **Borrow by re-implementation:** contract shapes only; no runtime dependency on
    pi/loop-engineering/openloop source. See `NOTICE`.
13. **Everything generic and public:** no private issue keys, hostnames, or app names
    anywhere in the repo.
