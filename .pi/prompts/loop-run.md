---
name: loop-run
description: Run one loopkit turn by executing loop/loop-driver.sh, honoring kill-switch, caps, reviewer gating, and persisted state.
---

# /loop-run

Run exactly one loop turn.

1. Read `loop/guards/README.md` and confirm no `loop/guards/STOP` file is present.
2. Run `bash loop/loop-driver.sh --help` if you need the available flags.
3. Run `bash loop/loop-driver.sh` with the configured registry, state dir, target
   repo, worker model, and reviewer model.
4. Report the round id, finding id, outcome, next action, and evidence paths from
   `loop/state/artifacts/round-NNN.json`.

Do not merge, auto-merge, push to `main`, or bypass a human checkpoint. An
approved verdict means `next_action: open_pr` with `human_checkpoint_required:
true`.
