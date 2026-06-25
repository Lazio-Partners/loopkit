# Contributing to loopkit

loopkit is a public, MIT toolkit that brings loop engineering to the **pi** harness (`earendil-works/pi`). This guide covers the dev loop, the pinned pi version, the borrow-don't-depend rule, how to run the readiness check, and the repo conventions.

Read [`AGENTS.md`](AGENTS.md) and [`docs/contracts.md`](docs/contracts.md) first — they hold the binding invariants every change must respect.

## The dev loop

loopkit extends three kinds of surface. Each has a fixed home and shape:

- **Add a skill** → `.pi/skills/<kebab-name>/SKILL.md` with `name` and `description` YAML frontmatter. A skill is invoked by *reading* its `SKILL.md` or via `/skill:<name>`. **There is no `Skill` tool in pi** — do not write code that calls one.
- **Add an agent (subagent)** → `.pi/agents/<kebab-name>.md` (markdown with frontmatter: `name`, `description`, `tools`, `model`). The reviewer's `model` MUST differ from the worker's (generator ≠ evaluator).
- **Add a guard** → `loop/guards/` (a bash script or a denylist entry). Guards enforce the four-costs limits.

**Connectors are CLI tools, not MCP servers.** `gh`, Linear (GraphQL via `curl`), and Slack are documented *inside* a `SKILL.md` and called as plain CLI commands. **loopkit ships no MCP server** — pi's idiom is to wrap external systems as CLI tools described in a skill.

## The pinned pi version

loopkit pins `pi-coding-agent` to the literal string **`0.80.x`** — patch allowed, **minor forbidden**, **no caret (`^`), no tilde (`~`)**.

**Why so strict:** pi's own `AGENTS.md` declares that **MINOR bumps are BREAKING** and there are no major releases. A caret range (`^0.80.0`) would silently pull a breaking `0.81`. A `0.80 → 0.81` bump can break the subagent example, the `--mode json` output shape, hook signatures, or skill-discovery paths loopkit depends on.

**Bumping the pin is a tracked finding** (`source: manual`, id `LK-NNNN`). The pin moves **only after** a green `npm run compat-check` **and** a proven `examples/first-loop` run. Bumping the pin without both is forbidden. (The compat-check and the first-loop example land in later issues — this is a forward reference.)

## Borrow, don't depend

loopkit takes contract *shapes* from pi, openloop, and loop-engineering by **re-implementation**. It takes **no runtime dependency** on those repos and does not redistribute their source. Respect their licenses: openloop is Apache-2.0, so its `NOTICE` text is **preserved verbatim** in our [`NOTICE`](NOTICE) (Apache-2.0 §4(d)). When you borrow another mechanic, add the attribution to `NOTICE`.

## Running loop-readiness

```sh
npx loopkit-readiness   # or: npm run readiness
```

`loopkit-readiness` reports L0-L3 readiness and can emit JSON for CI. A fresh
checkout may fail L0 if the installed pi minor does not match the pinned
`0.80.x` line; that is intentional.

## Conventions

- **Finding ids:** `LK-NNNN` (e.g. `LK-0007`), matching `^LK-\d{4}$`. This is the universal join key across the registry, verdicts, and round artifacts.
- **Branches:** `feat/lk-nnnn`. **Worktrees:** `.worktrees/feat-lk-nnnn`.
- **Bash scripts** start with `#!/usr/bin/env bash` and `set -euo pipefail`. **Never** interpolate program-derived strings into a shell (`shell=True`-style) — treat every program-derived string as untrusted (pi runs with full permissions and no sandbox).
- **Stage explicitly:** `git add <path>`. **Never `git add -A`** — other branches may carry unrelated dirty files.
- **Filenames and dirs are `kebab-case`. JSON keys are `snake_case`.**

## The `CLAUDE.md` symlink caveat

`CLAUDE.md` is a **relative symlink** to `AGENTS.md` so one memory file serves both pi and Claude Code. **Open risk:** a Windows checkout without symlink support (or a `git config core.symlinks=false` clone) may materialize `CLAUDE.md` as a plain text file containing the path `AGENTS.md` instead of following it. If you develop on Windows, confirm `core.symlinks=true` before committing, or the symlink will be silently broken.
