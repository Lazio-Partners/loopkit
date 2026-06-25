# First loop

This is the smallest runnable loopkit example: one failing sandbox test becomes
one finding, one worktree, one worker patch, one different-model reviewer
verdict, and one human checkpoint. It demonstrates all five moves without live
model keys.

> Security: pi runs with full user permissions and no sandbox. Mock mode avoids
> live model calls, but the live path can run commands as your user. Read
> `../../docs/security.md` before using `--live`.

## Run mock mode

```sh
bash examples/first-loop/run-first-loop.sh
```

The run writes:

- `examples/first-loop/loop/state/heartbeat.json`
- `examples/first-loop/loop/state/artifacts/round-001.json`
- `examples/first-loop/loop/state/progress.md`
- `examples/first-loop/loop/state/logs/round-001-tests.log`

The reviewer verdict says `next_action: open_pr` and
`human_checkpoint_required: true`. No PR is merged.

## Live mode

Set distinct `LOOPKIT_WORKER_MODEL` and `LOOPKIT_REVIEWER_MODEL`, then run with
`--live` after reading the driver flags. The reviewer model must differ from the
worker model.

Scheduling is intentionally dispatch-only in the sample workflow. For recurring
runs, use `../../docs/scheduling.md`.
