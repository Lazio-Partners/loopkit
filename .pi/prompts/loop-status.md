---
name: loop-status
description: Summarize loop/state heartbeat, latest round, progress, and halt status for a human checkpoint.
---

# /loop-status

Read the durable state outside the conversation and summarize it for a human.

1. Read `loop/state/heartbeat.json` if present.
2. Read the latest `loop/state/artifacts/round-NNN.json` if present.
3. Read the tail of `loop/state/progress.md` if present.
4. Report status, current finding, last turn, consecutive failures, cap usage,
   latest verdict, next action, and whether `loop/guards/STOP` is present.

Use plain English. Do not ask a model whether the loop is healthy when the state
already records a halt, failure count, or cap decision.
