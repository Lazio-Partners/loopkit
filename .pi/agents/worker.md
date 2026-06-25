<!-- Filled by a later issue: the handoff/driver issue authors the worker procedure. STUB: frontmatter + TODO body. -->
---
name: worker
description: The generator subagent — implements one finding inside its own isolated worktree, runs the deterministic floor, and hands off to the reviewer. Never self-promotes a finding to approved/done.
tools: [read, write, edit, bash]
model: PLACEHOLDER_WORKER_MODEL
---

# worker (stub)

TODO: author the worker procedure — read the finding, implement against its acceptance criteria in the assigned worktree, run tests/baseline, and stop. A worker may NEVER grade its own work or promote a finding's status; that is the driver's and reviewer's job.
