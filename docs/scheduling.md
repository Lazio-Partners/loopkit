# Scheduling

Scheduling is move 5 of a loop turn: external automation re-runs the loop after
discovery, handoff, verification, and persistence have done one turn.

> Security: pi runs with full user permissions and no sandbox. `--approve`
> skips the trust prompt. Only schedule a loop you have read and trust; the
> denylist, caps, circuit breaker, and kill-switch are seatbelts, not a sandbox.

The wrapper always pairs `--approve` with `PI_OFFLINE=1` and
`PI_SKIP_VERSION_CHECK=1`. Those flags prevent startup nags from blocking a
headless run. They do not skip loopkit's own gates.

| Mode | Where it runs | Tradeoff |
| --- | --- | --- |
| Local launchd/systemd | Your machine, your pi install, your credentials | Fast to set up and easy to watch; runs only when the machine is awake. |
| GitHub Actions | GitHub-hosted runner with Actions secrets | Runs while your machine is off; slower feedback and credentials live in repo secrets. |

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `__REPO_ROOT__` | Absolute path to this checkout for local schedulers. |
| `<your-model-id>` | The pi model id. Required; the wrapper refuses to guess. |
| `LOOPKIT_SKILL` | Slash prompt fired each time, default `/loop-discover`. |
| `LOOPKIT_MAX_ITERATIONS` | Per-trigger hard cap, default `1`. |
| `LOOPKIT_SESSION` | Optional pi session id. If unset, the wrapper resumes with `-c`. |

Never run bare scheduled `pi --approve`. Use `loop/schedule/run-scheduled.sh` so
the clean-start environment, iteration cap, resume behavior, and kill-switch are
always applied.
