# loopkit

**loopkit — loop engineering for the [pi](https://github.com/earendil-works/pi) coding agent.** Batteries-included: the five moves wired into one tested, guarded loop.

Loop engineering ([Addy Osmani's term](https://addyo.substack.com/)) is the shift from hand-prompting an agent line-by-line to building the *system* that prompts it. loopkit is that system for **pi** (`earendil-works/pi`) — **not** Claude Code.

## The five moves

- **Discovery** — the loop finds its own work (CI failures, tracker items, commits, review follow-ups) and writes each as a registry finding.
- **Handoff** — one finding becomes one isolated worktree and one worker agent.
- **Verification** — a *second, different-model* reviewer agent that can say **no**.
- **Persistence** — state is written *outside* the conversation, so it survives a context clear.
- **Scheduling** — external automation re-runs the loop on a cadence.

## Why loopkit

1. **THE translation repo.** loopkit is the one-to-one map from Claude Code primitives onto pi's real surface. If you know `/loop`, `/goal`, `--worktree`, `.claude/skills`, `.claude/agents`, MCP, and Cloud Routines, loopkit tells you exactly what each becomes on pi.
2. **Batteries-included.** The ecosystem ships scattered single-concern packages. loopkit wires all five moves into one loop you can run and test.
3. **Opinionated about ship discipline.** A named guardrail layer for the **four costs** of an unattended loop: verification debt, comprehension rot, cognitive surrender, and token blowout. See [`docs/four-costs.md`](docs/four-costs.md).

## Translation teaser

The full map is in [`docs/primitive-translation.md`](docs/primitive-translation.md). A taste:

| Claude Code primitive | pi surface | loopkit file |
|-----------------------|------------|--------------|
| `/loop` (run-until-condition) | external scheduler wrapping `pi -p --approve` | `loop/loop-driver.sh` + `loop/schedule/` |
| `--worktree` | plain `git worktree` | `loop/worktree.sh` |
| `.claude/skills/<name>` | `.pi/skills/<name>/SKILL.md` (read or `/skill:<name>`) | `.pi/skills/` |
| `.claude/agents/<name>` | `.pi/agents/<name>.md` | `.pi/agents/` |

## The centerpiece: a reviewer that can say "no"

loopkit's verification move runs a **reviewer subagent on a *different model* than the worker**, with skeptical instructions. A model grading its own homework is not verification. And loopkit **never auto-merges** — an `approve` verdict only ever means "ready for a *human* to merge." CI green is necessary, not sufficient.

## The four-costs thesis

Unattended loops accrue four costs — **verification debt, comprehension rot, cognitive surrender, token blowout** — and loopkit maps a specific guard to each. See [`docs/four-costs.md`](docs/four-costs.md).

> ## ⚠️ Security: pi runs with FULL user permissions and NO sandbox
>
> loopkit can run commands, edit files, and push branches **as you**. A scheduled `--approve` loop acts on your machine with your full authority and **NO sandbox**.
>
> Read [`docs/security.md`](docs/security.md), review the denylist (`loop/guards/denylist.txt`), and **never point a scheduled `--approve` loop at anything you wouldn't run unattended.**

## Quickstart

```sh
npm install
npm test
npx loopkit-readiness --json
bash examples/first-loop/run-first-loop.sh
```

## Examples

- [`examples/first-loop/`](examples/first-loop/README.md): smallest broken-test to reviewed-PR checkpoint.
- [`examples/ship-pipeline/`](examples/ship-pipeline/README.md): generic team ship pipeline with a tracker-shaped finding.

## Proven pi version

Proven against pi **`0.80.x`** (`pi-coding-agent`). **pi treats MINOR bumps as breaking** (its own `AGENTS.md` says so), so loopkit pins the exact minor and forbids `^`/`~`. Bumping the pin is a tracked finding requiring a green compat-check and a proven example run — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](LICENSE). loopkit borrows mechanics from pi, openloop, and loop-engineering by *re-implementation* and takes no runtime dependency on them; see [`NOTICE`](NOTICE).
