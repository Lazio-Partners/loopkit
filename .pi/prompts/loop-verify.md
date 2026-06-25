---
name: loop-verify
description: Invoke the different-model reviewer and capture a schema-valid verdict for one LK-NNNN finding.
---

# /loop-verify

Verification is independent. The reviewer model must differ from the worker
model and can say no.

1. Read `.pi/agents/reviewer.md`.
2. Read `.pi/skills/loop-verifier/SKILL.md`.
3. Give the reviewer the finding, worktree, branch, worker model, reviewer model,
   worker handoff, and deterministic floor command.
4. Require exactly one trailing fenced `json` verdict block.
5. Validate the block against `loop/state/schema/verdict.schema.json`.

An `approve` still stops at a human checkpoint and routes to `open_pr`; it never
means merge.
