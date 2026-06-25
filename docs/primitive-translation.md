<!-- Filled by a later issue: the translation issue completes the rows below. This is the table header + a few seed rows. -->

# Primitive translation: Claude Code → pi

loopkit is THE translation repo: the one-to-one map from Claude Code primitives onto pi's real surface. pi is **not** Claude Code — it ships no MCP servers, no scheduler, no `/loop`/`/goal`, no worktree wrapper. Where Claude Code hands you a built-in, pi expects you to wrap a CLI tool or a small script. The full map below is completed by the translation issue; these seed rows show the shape.

| Claude Code primitive | pi surface | loopkit file |
|-----------------------|------------|--------------|
| `/loop` (run-until-condition) | external scheduler wrapping `pi -p --approve` (pi has no loop primitive) | `loop/loop-driver.sh` + `loop/schedule/` |
| `--worktree` | plain `git worktree` (pi has no worktree wrapper) | `loop/worktree.sh` |
| `.claude/skills/<name>` | `.pi/skills/<name>/SKILL.md` — read or run via `/skill:<name>` (no `Skill` tool) | `.pi/skills/` |
| `.claude/agents/<name>` | `.pi/agents/<name>.md` (markdown + frontmatter) | `.pi/agents/` |

<!-- TODO (translation issue): add rows for /goal, MCP servers → CLI-tool-in-a-skill, Cloud Routines → loop/schedule/*, hooks, --mode json, --approve, settings.skills cross-harness discovery. -->
