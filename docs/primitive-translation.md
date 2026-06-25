# Primitive translation: Claude Code → pi

## Why this map

loopkit is **the translation repo**. If you already drive an agent with Claude Code, you know its primitives — `/loop`, `/goal`, `--worktree`, `.claude/skills`, `.claude/agents`, MCP servers, Cloud Routines, `/implement`. This document maps each one onto **pi**'s real surface (`earendil-works/pi`), and marks every row by *how much loopkit had to supply* to give you the same capability. Three labels, used exactly:

- **native** — pi ships the equivalent itself; you use pi's own feature.
- **via-example** — pi does not ship it as a turnkey command, but its official **subagent example** (`packages/coding-agent/examples/extensions/subagent/`, MIT, Mario Zechner) demonstrates how; loopkit follows that pattern.
- **toolkit-supplied** — pi has no equivalent at all; **loopkit builds it.** All three hard gaps (no scheduler, no `git worktree`, no `/goal`) fall here.

Read this before reaching for a Claude Code habit that pi does not have a button for.

## The map

| Claude Code primitive | pi surface | Classification | Notes |
|-----------------------|-----------|----------------|-------|
| `/loop` (recurring run) | external scheduler templates `loop/schedule/{launchd.plist,systemd.timer,loop.yml}` wrapping `pi -p --approve`, driven by `loop/loop-driver.sh` | toolkit-supplied | Hard gap: pi has **no** scheduler/cron/daemon. Recurrence is fully external. See [The three hard gaps](#the-three-hard-gaps). |
| `/goal` / run-until-condition | the built stop-gate: `loop/loop-driver.sh` + a different-model reviewer (`.pi/agents/reviewer.md`) emitting a verdict + a deterministic floor (`verdict.checks`) | toolkit-supplied | Hard gap: pi has **no** `/goal` or judge. loopkit builds the run-until-condition loop, the second-opinion reviewer, and the deterministic check floor. |
| `--worktree` | `loop/worktree.sh` wrapping plain `git worktree` (anchors `--git-common-dir`, prunes stale trees, reuses a tracked branch, symlinks env files) | toolkit-supplied | Hard gap: pi has **no** worktree integration. loopkit wraps stock git. |
| `.claude/skills/<name>` | `.pi/skills/<name>/SKILL.md` (the same Agent Skills standard: YAML frontmatter `name` + `description`, then a progressive-disclosure body) | native | Cross-harness: `settings.skills` can also point at other Agent-Skills-standard dirs (e.g. `~/.claude/skills`), so the **same** `SKILL.md` runs on pi and any other harness that reads the standard. Invoke it by `read`-ing the file or `/skill:<name>` — there is no `Skill` tool (see below). |
| `.claude/agents/<name>` | `.pi/agents/<name>.md` (frontmatter `name`/`description`/`tools`/`model` + a system-prompt body) spawned by the subagent example/SDK | via-example | Borrowed from the pi **official subagent example** (`packages/coding-agent/examples/extensions/subagent/`, MIT, Mario Zechner). |
| Subagent / Task tool | spawn a `pi --mode json` **subprocess** per task with its own model + tool allowlist + isolated context (modes: single / parallel — max 8, 4 concurrent, 50KB per task / chain) | via-example | Same subagent example. This subprocess-per-task model is how loopkit keeps a worker and a reviewer on **different** models in **isolated** contexts. |
| `/implement` | pi's `/implement` (scout → planner → worker) and `/implement-and-review` (worker → reviewer → worker) presets | native | The presets ship with pi. loopkit's own worker/reviewer split is the generator≠evaluator skeleton, **borrowed from the pi subagent example** (`packages/coding-agent/examples/extensions/subagent/`); pi also dogfoods `/is` (explicitly **adversarial**) and `/pr` (Good/Bad/Ugly/Tests), which loopkit's reviewer instructions echo. |
| MCP servers | none — pi ships no MCP on purpose; wrap each external system as a **CLI tool documented inside a `SKILL.md`** (e.g. `gh`, Linear via a GraphQL `curl`, `slack`) | toolkit-supplied | CLI-skills-first. An MCP-**client** extension is an optional, **later**, out-of-Tier-0 path — not required to run a loop. See [MCP](#mcp). |
| Cloud Routines / scheduled agents | the same external schedulers as `/loop`; `loop/schedule/loop.yml` (GitHub Actions cron) is the cloud analog wrapping `pi --mode json --approve` | toolkit-supplied | Hard gap (same root as `/loop`): there is no hosted pi scheduler. |
| Memory / `--resume` | pi sessions auto-saved as JSONL trees under `~/.pi/agent/sessions/`; resume via `-c` / `-r` / `--session` / `--fork`; plus `pi.appendEntry(type, data)` rehydrated on `session_start` | native | `AGENTS.md` / `CLAUDE.md` are auto-loaded as project memory. Out-of-conversation state (the loop's persistence move) is written via `pi.appendEntry`. |
| `Skill` tool invocation | **there is no `Skill` tool in pi** — `read` the skill's `SKILL.md` (progressive disclosure) or run `/skill:<name>` | native | The no-Skill-tool gotcha: skill invocation is native to pi, but it works by reading the file or the slash command, **not** by a `Skill` tool. This is the single most load-bearing difference. See [There is no Skill tool](#there-is-no-skill-tool). |
| Hooks (PreToolUse / PostToolUse) | `pi.on('tool_call', …)` (can **block** via `{block:true,reason}` or mutate args) / `pi.on('tool_result', …)` (mutable) / `turn_start` / `turn_end` / `agent_end` / `before`/`after_provider_request` / `context` | native | loopkit's denylist guard is a `tool_call` hook that returns `{block:true,reason}` before a banned command runs. |
| Headless `-p` | `pi -p` / `--mode json` (single-shot; prints `stopReason` / `exitCode`) and `--mode rpc` (JSON-RPC subprocess); `--approve` skips the trust prompt for unattended runs | native | Pair unattended runs with `PI_OFFLINE` / `PI_SKIP_VERSION_CHECK` so the version nag never blocks the loop. This is the headless entry point every scheduler template invokes. |

Thirteen primitives, one row each. Classifications are exactly `native`, `via-example`, or `toolkit-supplied` — the accompanying test fails on any other value.

The "files-exist is not loop-works" framing (see [`docs/architecture.md`](architecture.md), [`docs/four-costs.md`](four-costs.md)) and the on-disk state shape are re-implemented from upstreams credited in [`NOTICE`](../NOTICE); this map does not duplicate that material.

## The three hard gaps

pi is a coding agent, not a loop runner. Three Claude Code primitives have **no** pi equivalent, so loopkit supplies each one. These are the rows marked **toolkit-supplied** above, called out here because they are the load-bearing absences.

### No scheduler

pi has no cron, daemon, or recurring-run primitive. Recurrence is entirely external. loopkit ships scheduler templates at `loop/schedule/launchd.plist` (macOS), `loop/schedule/systemd.timer` (Linux), and `loop/schedule/loop.yml` (GitHub Actions / cloud) — each wraps `pi -p --approve` and invokes `loop/loop-driver.sh`. (Those files are authored by later issues; the paths above are forward references.)

### No `git worktree`

pi has no worktree integration. One finding → one isolated worktree is loopkit's handoff move, so loopkit wraps stock git in `loop/worktree.sh` (anchoring `--git-common-dir`, pruning stale trees, reusing a tracked branch, and symlinking env files into the new tree).

### No `/goal` / stop-gate

pi has no `/goal`, no run-until-condition, and no judge. loopkit **builds** the stop-gate from three independent pieces: `loop/loop-driver.sh` (the run-until-condition driver and the three independent halts — failure ceiling, daily turn cap, token budget), `.pi/agents/reviewer.md` (the *different-model* reviewer that can say **no**), and a deterministic check floor (`verdict.checks`) so a green CI is necessary but never sufficient. loopkit never auto-merges: an advancing verdict only ever means "ready for a *human* to merge."

## There is no Skill tool

pi has **no** `Skill` tool. You do **not** "call a skill" and there is no tool named `Skill` to invoke.

A skill is invoked one of two ways:

1. **`read` its `SKILL.md`** — progressive disclosure: the agent reads the file (and any files it points to) into context, then acts on the instructions.
2. **Run `/skill:<name>`** — the slash command that surfaces the skill.

Skills live at `.pi/skills/<name>/SKILL.md` and are also discovered from `~/.pi/agent/skills`, `.agents/skills`, packages, and `settings.skills` (which can additionally point at other Agent-Skills-standard dirs, e.g. `~/.claude/skills`, for cross-harness reuse).

Connectors are **CLI tools documented inside a `SKILL.md`**, not MCP servers: `gh` (GitHub), a GraphQL `curl` against a tracker's API, `slack`, and so on. The skill body tells the agent which command to run and how to read its output. This is a deliberate prefer-CLI-over-MCP stance; the optional MCP-client path is later and out of Tier-0 (see [MCP](#mcp)).

## MCP

pi ships **no** MCP, on purpose. loopkit's idiom is the same: wrap each external system as a **CLI tool documented in a `SKILL.md`** rather than standing up an MCP server. This is more token-efficient (no tool-schema overhead on every turn), works anywhere a shell works, and is simpler to debug.

An MCP-**client** extension — so a loop could talk to an existing MCP server — is an **optional, later** capability, explicitly **out of Tier-0**. You can run the full loop without it.

## Proven against pi

Every row above is asserted against pi pinned to **`@earendil-works/pi-coding-agent@0.80.x`** (literal — no caret, no tilde). **pi treats MINOR bumps as breaking** (its own `AGENTS.md` says so), so a `0.80 → 0.81` move can change any surface this map describes. A row's accuracy therefore holds only against the pinned minor; the pin is verified by the **compat-check** (`npm run compat-check`), which hard-fails when the installed pi's `MAJOR.MINOR` drifts from `0.80`. Moving the pin is a tracked finding requiring a green compat-check and a proven example run — see [`CONTRIBUTING.md`](../CONTRIBUTING.md).
