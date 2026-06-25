# Ship pipeline

This showcase wires a generic team shipping loop: tracker finding, isolated
worktree, worker patch, different-model reviewer, PR checkpoint, persisted
state. It uses mock mode by default so it runs in CI without API keys.

> Security: pi runs with full user permissions and no sandbox. Read
> `../../docs/security.md` before running live.

## Run

```sh
bash examples/ship-pipeline/run-pipeline.sh
```

The dry run uses `seed-tracker.sh` and the local sample repo. To point it at a
real tracker, replace `LOOPKIT_TRACKER_CMD` with a command from
`.pi/skills/gh-issues/SKILL.md` or `.pi/skills/linear-graphql/SKILL.md`.

The reviewer model must differ from the worker model. `approve` opens a human
checkpoint path and never merges.
