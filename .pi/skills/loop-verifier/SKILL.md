---
name: loop-verifier
description: Skeptically verify one worker result against a finding and emit the loopkit verdict JSON. Read this SKILL.md or run /skill:loop-verifier; pi has no tool named Skill.
---

# loop-verifier

Use this when the driver asks for a reviewer verdict for one finding. The default
posture is doubt: a green command is evidence, not proof. The generator must
never grade its own work.

## Inputs

- `finding_id` matching `LK-NNNN`.
- Worker model and reviewer model. They must differ.
- The assigned worktree and branch.
- The finding acceptance criteria, detector, and worker handoff.
- The deterministic floor command and any baseline output.

## Verification steps

1. Confirm scope: the diff only addresses the assigned finding and does not touch
   unrelated files.
2. Run the deterministic floor yourself. Record the command, exit code, and log
   path.
3. Compare against the baseline or detector. If a claim cannot be checked, say so
   in `findings.ugly` or `blocking_reasons`.
4. Check the denylist scope in `denylist-scope.txt`; refuse a verdict that
   requires merge, force-push, broad deletion, or writing secrets.
5. Emit exactly one trailing fenced `json` block matching
   `loop/state/schema/verdict.schema.json`.

## Required verdict invariants

- `reviewer_model` and `worker_model` are both filled and not equal.
- `approve` always pairs with `human_checkpoint_required: true` and
  `next_action: "open_pr"`.
- If tests did not run or did not pass, do not approve.
- If `findings.bad` has any entries, do not approve.
- Non-UI work sets `checks.app_drive.ran` to false and explains that visual
  verification is not applicable.

There is no tool named Skill in pi. The agent reads this `SKILL.md` or runs
`/skill:loop-verifier`; it does not call a tool named Skill.
