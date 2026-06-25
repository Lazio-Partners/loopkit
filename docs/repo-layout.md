# loopkit repo layout (frozen Tier-0 contract)

This is the frozen directory tree loopkit builds against. W0-0 creates only the
paths a downstream consumer needs **now** (the schemas, tools, docs, and the
tracked-but-empty state dirs). The `.pi/`, `examples/`, and `.github/` trees are
**owned by their own issues** — they are documented here so downstream authors
know where their files land, but W0-0 does not scaffold them.

```
loopkit/
├── LICENSE                         # MIT, "Copyright (c) 2026 loopkit contributors"
├── NOTICE                          # attributions: pi (MIT), loop-engineering (MIT), openloop (Apache-2.0, NOTICE preserved)
├── AGENTS.md                       # project memory (binding invariants); auto-loaded by pi + Claude Code
├── CLAUDE.md                       # symlink -> AGENTS.md (one memory file, two harnesses)
├── package.json                    # name "loopkit", pi pin 0.80.x, scripts, loopkit-readiness bin
│
├── docs/
│   ├── contracts.md                # THE canonical contracts narrative — a zero-memory agent reads this first
│   └── repo-layout.md              # this file
│
├── loop/                           # the loop runtime (driver/guards/helpers are DOWNSTREAM); W0-0 ships only state schemas
│   └── state/
│       ├── schema/
│       │   ├── verdict.schema.json     # reviewer's single machine-read output
│       │   ├── heartbeat.schema.json   # compact machine state, overwritten each turn
│       │   ├── round.schema.json       # immutable per-turn report (embeds verdict via $ref)
│       │   └── fixtures/
│       │       ├── verdict.valid.json
│       │       ├── verdict.invalid.json
│       │       ├── heartbeat.valid.json
│       │       └── round.valid.json
│       ├── artifacts/.gitkeep      # round-NNN.json immutable per-turn reports land here (runtime)
│       ├── logs/.gitkeep           # free-form logs (runtime)
│       └── knowledge/.gitkeep      # accumulated knowledge notes (runtime)
│       # (runtime, downstream) heartbeat.json + progress.md are WRITTEN here by the helpers issue.
│
├── patterns/
│   ├── registry.schema.json        # the work-registry schema (join key + driver-only transitions)
│   ├── registry.example.yaml       # validates against registry.schema.json
│   └── registry.yaml               # (downstream) the live registry the loop reads
│
├── tools/
│   ├── validate-schemas.mjs        # validates every example/fixture vs its schema (npm run validate:schemas)
│   ├── compat-check.mjs            # probes 4 pi surfaces; HARD FAIL on MAJOR.MINOR mismatch
│   ├── compat-check.test.mjs       # unit test: fake pi version -> assert hard-fail + remediation
│   └── loop-readiness.mjs          # loopkit-readiness bin STUB (L0–L3 audit is downstream)
│
├── .pi/                            # (DOWNSTREAM, NOT created by W0-0) pi auto-discovery surface
│   ├── agents/<name>.md            #   subagent defs (markdown + frontmatter): worker.md, reviewer.md
│   ├── skills/<name>/SKILL.md      #   Agent-Skills-standard skills (read or run via /skill:<name>)
│   └── prompts/                    #   prompt templates
│
├── examples/                       # (DOWNSTREAM) examples/first-loop, scheduling templates
│
└── .github/
    └── workflows/loop-gate.yml     # (DOWNSTREAM) CI gate calling compat-check + validate-schemas
```

## Load-bearing notes

- **Skills vs agents — never confuse them.** A pi **skill** lives at
  `.pi/skills/<name>/SKILL.md` and is invoked by *reading* it or via
  `/skill:<name>` — **there is no `Skill` tool in pi**. A pi **subagent** lives at
  `.pi/agents/<name>.md` (markdown with frontmatter). pi auto-discovers both.
- **One skill, many harnesses.** pi's `settings.skills` may also point at other
  Agent-Skills-standard skill dirs (e.g. `~/.claude/skills`), so a single skill
  definition can run on pi, Claude Code, and other compatible harnesses without
  duplication.
- **State dirs are tracked empty.** `artifacts/`, `logs/`, and `knowledge/` ship
  with a `.gitkeep` so the runtime (downstream) can write into existing paths.
