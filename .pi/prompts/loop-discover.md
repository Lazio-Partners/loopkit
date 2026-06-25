---
name: loop-discover
description: Find one new unit of work from configured sources and append it to patterns/registry.yaml as an LK-NNNN finding.
---

# /loop-discover

Discovery turns outside signals into registry findings. Prefer one high-quality
finding over a batch.

1. Read configured connector skills such as `.pi/skills/gh-issues/SKILL.md` or
   `.pi/skills/linear-graphql/SKILL.md` when the source is an issue tracker.
2. Inspect CI, tracker output, recent commits, or review follow-ups. Use explicit
   commands and keep their output as evidence.
3. Dedupe against `patterns/registry.yaml`.
4. Append exactly one finding with a fresh `LK-NNNN` id, `source`, `source_ref`,
   `priority`, `isolation.branch`, `isolation.worktree`, `acceptance`, and a
   re-runnable `detector`.
5. Run `node patterns/validate-registry.mjs`.

Early exit is correct when no source yields actionable work. Never use a
vendor-directory existence check as the detector; the detector must prove work.
