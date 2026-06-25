# The four costs

An unattended agent loop pays four hidden costs. They are not bugs you can fix once. They compound the longer the loop runs without a human in the seat, and the rest of the loop-engineering ecosystem mentions them in passing without systematically guarding against any of them. loopkit names all four, and for each one points at the concrete guard in this repo that makes it bite — the mechanism, not a slogan. This doc is the threat model behind loopkit's guard layer: it explains *why* each guard exists so you can tell a real guard from verification theater.

If you only remember one thing: a guard you never proved fires is not a guard. Naming a cost is the easy half; the load-bearing half is the path-and-trigger that stops the loop.

## How the four costs connect to the five moves

loopkit wires five moves — **Discovery** (the loop finds its own work), **Handoff** (one finding becomes one isolated worktree plus agent), **Verification** (a second, different-model agent that can say *no*), **Persistence** (state on disk, outside the conversation), **Scheduling** (external automation re-runs it). Each cost lands on a specific move:

- **Verification debt** is a failure of **move 3 (Verification)** — output outruns review.
- **Comprehension rot** is a failure of **move 4 (Persistence)** plus the human checkpoint — the on-disk narrative is the only thing keeping a human in the loop.
- **Cognitive surrender** is a failure of the **generator ≠ evaluator** contract and the human veto — the ability to say *no* atrophies.
- **Token blowout** is a failure of **move 5 (Scheduling)** when it runs without caps — an unattended run that can run away.

See [architecture.md](./architecture.md) for how the moves wire together and where the generator ≠ evaluator contract lives.

## Verification debt

**Definition.** The loop produces output faster than anyone verifies it, so unreviewed work piles up.

**Why it compounds.** A wrong assumption in turn 3 — the shape of an API, the meaning of a flag, what "passing" means for a test — silently poisons turns 4 through 40. The loop builds on its own unchecked output. By the time a human looks, the debt is not one bad turn; it is every turn that stood on it. Nothing flags this on its own, because the loop has no reason to doubt itself.

**The guard.** A *different-model* evaluator plus a deterministic floor under it. The evaluator is [`.pi/agents/reviewer.md`](../.pi/agents/reviewer.md): a separate `pi --mode json` subagent whose `model` MUST differ from the worker's. Under the evaluator sits a deterministic floor — tests and a baseline that are *parsed and compared* in `verdict.checks`, never just printed to a log. The generator never grades its own homework.

**How it bites.** The driver asserts `reviewer_model != worker_model` and fails loud on violation. A verdict that says `approve` but carries `confidence < 0.5`, a non-empty `findings.bad`, or `checks.tests.passed != true` is auto-downgraded to `needs_changes`. No work advances on the worker's say-so. This is move 3.

## Comprehension rot

**Definition.** As the loop runs unattended, the human's mental model of the codebase decays. You stop being able to explain why the code is the way it is, and you can no longer tell a good change from a plausible-looking bad one.

**Why it compounds.** Every turn the human does not read widens the gap between what the code does and what the human thinks it does. A reviewer who cannot model the system cannot review it — they can only check whether CI is green, which is exactly the rubber-stamp the next cost describes. The decay is silent: the day you can no longer explain the code is not announced.

**The guard.** A read-the-output cadence. Three pieces: a **mandatory human checkpoint** (`verdict.human_checkpoint_required` is always `true` on any advancing verdict — loopkit *never* auto-merges); an **append-only** narrative at `loop/state/progress.md` (one human-readable block per turn); and the `/loop-status` slash command that prints the on-disk state for a human to read. (`loop/state/progress.md` is the documented contract for the per-turn narrative; the file is written by the loop driver, built in another issue.)

**How it bites.** The strongest verdict, `approve`, only ever yields `next_action: open_pr` — a human reads the diff and merges. CI green is necessary, not sufficient. The per-turn `progress.md` block (worker model, reviewer model, `bad[]`, confidence, evidence path) is the artifact the human reads to stay in the loop. This connects to move 4 (Persistence) and the human checkpoint.

## Cognitive surrender

**Definition.** The human starts rubber-stamping because the agent is usually right. The ability to say *no* atrophies until it is gone.

**Why it compounds.** Each correct-looking approval makes the next one easier to wave through. Skepticism is a muscle; unused, it wastes. And it compounds across both reviewers — the agent reviewer drifts toward "approve to be agreeable," and the human drifts toward "the agent approved it, so it's fine." Two reviewers who have both stopped dissenting are not two checks; they are zero.

**The guard.** Keep the ability to say *no*, structurally — do not rely on either reviewer choosing to be skeptical. The agent reviewer is *built to dissent*: its skeptical instructions are lifted from pi's own `/is` prompt ("do not trust the stated RCA; independently verify") and `/pr` prompt ("Good / Bad / Ugly / Tests"). The verdict schema *requires* `evidence` for behavioral claims and a non-empty `blocking_reasons` whenever the verdict is not `approve`. The human checkpoint is non-removable.

**How it bites.** A verdict with no `evidence` for a `findings.good` behavioral claim is surfaced as a reviewer-instruction violation, not silently accepted. The reviewer cannot "approve to be agreeable" — low confidence and any `bad[]` item force a downgrade (the same mechanism as verification debt, here aimed at the reviewer's own agreeableness). The human keeps a real veto because the system hands them structured dissent to act on, not a green checkmark. This rests on the generator ≠ evaluator contract in [architecture.md](./architecture.md).

## Token blowout

**Definition.** An unattended loop can burn enormous token cost spinning on a task it will never finish, with nothing shippable to show.

**Why it compounds.** A loop with no halt does not get tired and does not get discouraged. Pointed at a problem it cannot solve, it retries the same dead end every turn, at full token cost, until something external stops it — usually a human waking up to the bill. The cost is unbounded in exactly the case where the output is worthless.

**The guard.** Hard caps plus retry limits plus a kill switch — the **three independent halts**, none of which the loop can disable for itself:

1. **Daily cap** — [`loop/guards/caps.sh`](../loop/guards/caps.sh): when `turns_today >= daily_cap`, no new turn starts.
2. **Circuit breaker** — [`loop/guards/circuit-breaker.sh`](../loop/guards/circuit-breaker.sh): when `consecutive_failures >= max_consecutive_failures`, `heartbeat.status` flips to `blocked`.
3. **Kill-switch file** — `loop/guards/kill-switch`: the presence of the file `loop/guards/STOP` aborts every turn at the top of the driver. (The kill-switch script is the documented contract; it is built in the guards issue, so it is named here as a path, not yet linked.)

On top of the three halts: per-turn token and time caps, an `early_exit_required` check, and `tokens_today` tracked in `loop/state/heartbeat.json` as a surfaced — advisory — blowout checkpoint. (`heartbeat.json` is where `consecutive_failures`, `turns_today`, `tokens_today`, and `status` live; it is the documented state contract, written by the loop driver.)

**How it bites.** Every turn checks all three halts at the top and fails loud if any is tripped; `caps.sh` refuses to start a turn that is over budget. The cap and breaker are borrowed-and-hardened from openloop (see below). This is move 5 (Scheduling): `--approve` is paired with caps so an unattended run cannot run away. See [scheduling.md](./scheduling.md) for the safe-scheduling recipe and [security.md](./security.md) for why `--approve` is dangerous bare.

## Cost to guard, at a glance

| Cost | What it is | Why it compounds | The guard | How it bites |
|------|------------|------------------|-----------|--------------|
| **Verification debt** | Output ships faster than anyone verifies it. | A wrong turn-3 assumption silently poisons every later turn built on it. | Different-model evaluator ([`.pi/agents/reviewer.md`](../.pi/agents/reviewer.md)) + a deterministic floor (parsed/compared tests + baseline in `verdict.checks`). | Driver asserts `reviewer_model != worker_model`; an `approve` with low confidence, any `bad[]`, or failing tests auto-downgrades to `needs_changes`. |
| **Comprehension rot** | The human's model of the code decays until they cannot judge a change. | Every unread turn widens the gap; a reviewer who can't model the system can only check CI. | Mandatory human checkpoint (`human_checkpoint_required: true`) + append-only `loop/state/progress.md` + `/loop-status`. | `approve` only ever yields `next_action: open_pr`; the per-turn `progress.md` block is what the human reads to stay in the loop. |
| **Cognitive surrender** | The human (and the agent reviewer) rubber-stamp; the ability to say *no* atrophies. | Each correct-looking approval makes the next rubber-stamp easier, on both reviewers at once. | A reviewer *built to dissent* (skeptical instructions from pi's `/is` + `/pr`) + required `evidence` + non-removable human checkpoint. | A behavioral claim with no `evidence` is flagged as a reviewer-instruction violation; low confidence + any `bad[]` force a downgrade; the human gets structured dissent, not a checkmark. |
| **Token blowout** | The loop burns unbounded token cost on a task it never finishes. | A loop never tires; it retries the same dead end every turn until something external halts it. | Three independent halts — daily cap ([`caps.sh`](../loop/guards/caps.sh)), circuit breaker ([`circuit-breaker.sh`](../loop/guards/circuit-breaker.sh)), kill-switch file (`loop/guards/kill-switch`) — none disableable by the loop. | Every turn checks all three at the top and fails loud if tripped; `caps.sh` refuses to start an over-budget turn. |

## The openloop lesson: prove the guard fires

loopkit borrows the on-disk loop-state layout and the persisted-circuit-breaker shape from **openloop** (Apache-2.0). Per Apache-2.0 section 4, openloop's NOTICE is preserved in this repo's [NOTICE](../NOTICE) file. We borrow the *structure*, not the bugs — and openloop's bugs taught us two rules we adopt as doctrine.

**A monitoring claim must itself be verified.** openloop's own stall-detection was dead code, and its out-of-memory detection was a gameable regex over stdout. Both *looked* like guards in the source tree, and neither ever actually fired. Monitoring that cannot be shown to halt the loop is not monitoring; it is a comment that resembles one. loopkit forks these out: no stdout-regex liveness check, no dead stall code.

**Printing a metric is not a gate.** A guard that prints `coverage: 74%` to a log and moves on has gated nothing — no comparison happened, nothing was blocked. loopkit's deterministic floor *parses and compares*: `verdict.checks.baseline` carries `{ before, after, regressed }`, and a `regressed: true` is a blocking fact, not a line in a log a human might skim past.

State the lesson plainly: **a guard you never proved fires is verification theater.** loopkit's guards are tested to actually halt the loop. This doc's own content checks (see [Verifying this doc](#verifying-this-doc)) are written to fail on a mutated copy, and the repo's readiness doctrine in `tools/loop-readiness.mjs` encodes the same idea at the L0 through L3 levels — "the files exist" is not "the loop works." We also forked openloop's third footgun: no `shell=True`-style interpolation of a program-derived `last_error` into a command. We borrow the persisted circuit breaker and the parsed baseline; we leave the bugs.

## Honest failure stories

The point of naming costs is to recognize them in the wild before the bill arrives. These are illustrative and generic — they describe shapes of failure, not real people or companies. Use the template to write your own when a loop burns you; an honest failure story is worth more than another paragraph of theory.

### Template

- **Setup.** What was the loop told to do?
- **What went wrong.** Which of the four costs manifested?
- **What the absent or weak guard would have caught.** Where was the hole?
- **The fix loopkit ships.** Which guard, named by path and trigger, closes it?

### Worked example: the overnight retry (token blowout)

- **Setup.** A loop is pointed at a flaky integration test with the instruction "make the suite green." The right move is to quarantine the flake and move on; the loop does not know that.
- **What went wrong.** **Token blowout.** The loop retries essentially the same fix every turn, the flaky test fails again on roughly half its runs, and the loop reads each failure as "not done yet." Overnight it burns about $40 of tokens and produces nothing mergeable.
- **What the absent or weak guard would have caught.** With no `consecutive_failures` ceiling and no daily cap, nothing stopped the loop except the human waking up. The only halt was a human noticing the bill.
- **The fix loopkit ships.** The **circuit breaker** ([`circuit-breaker.sh`](../loop/guards/circuit-breaker.sh)) flips `heartbeat.status` to `blocked` after `consecutive_failures >= max_consecutive_failures`, and the **daily cap** ([`caps.sh`](../loop/guards/caps.sh)) refuses a new turn once `turns_today >= daily_cap`. Either one stops the overnight burn before it starts; both run before the first dollar of the morning's tokens.

### Worked example: the silent wrong assumption (verification debt)

- **Setup.** A loop is asked to migrate calls to a renamed API. In turn 3 it guesses the new function's argument order wrong.
- **What went wrong.** **Verification debt.** The wrong assumption type-checks and the loop keeps going. Twelve later turns build on the wrong call shape. No reviewer ever challenges turn 3, so the error is not one bad turn — it is thirteen.
- **What the absent or weak guard would have caught.** The worker grading its own output had no reason to doubt turn 3. There was no second, differently-modeled reader to independently verify the API shape against the behavior, and no parsed baseline to catch the behavioral regression the wrong argument order introduced.
- **The fix loopkit ships.** The different-model evaluator ([`.pi/agents/reviewer.md`](../.pi/agents/reviewer.md)) reads turn 3's diff against the finding's acceptance and must produce `evidence` for any behavioral claim; the deterministic floor compares `verdict.checks.baseline` so a behavioral regression is a `regressed: true` blocking fact. The wrong assumption is caught at turn 3, before it propagates.

## Verifying this doc

This doc has a deterministic floor of its own, in keeping with the openloop lesson above. `tools/check-four-costs.mjs` asserts the load-bearing content is present — all four cost names, a cost-to-guard table with at least four data rows, every named guard path, both openloop-lesson phrases, the failure-story template plus at least one worked example, and a generic-purity grep (no private tokens). The check is wired into `npm test`. It is written to **fail on a mutated copy** — delete a cost section and the test goes red — because a "four costs" doc that silently lists three is the exact comprehension-rot failure this doc warns about. Naming a guard is cheap; proving the guard fires is the work.
