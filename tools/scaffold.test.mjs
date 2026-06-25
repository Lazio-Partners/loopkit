#!/usr/bin/env node
// loopkit scaffold test (W0-1) — asserts acceptance criteria 1–12 of the scaffold issue.
//
// Run via `node --test tools/scaffold.test.mjs` (also discovered by `node --test`).
// Each test encodes WHY the assertion matters, not just WHAT it checks, so a future
// change that breaks an invariant fails loudly with a reason.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, lstatSync, readlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(ROOT, rel);
const readText = (rel) => readFileSync(p(rel), "utf8");
const readJson = (rel) => JSON.parse(readText(rel));

// The complete frozen layout. WHY: later issues need every directory to already exist
// as a home to write into; a missing path means a downstream issue has nowhere to land.
const FROZEN_PATHS = [
  "README.md",
  "LICENSE",
  "NOTICE",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  ".gitignore",
  "docs/primitive-translation.md",
  "docs/four-costs.md",
  "docs/security.md",
  "docs/architecture.md",
  "docs/scheduling.md",
  ".pi/prompts/loop-discover.md",
  ".pi/prompts/loop-run.md",
  ".pi/prompts/loop-verify.md",
  ".pi/prompts/loop-status.md",
  ".pi/skills/loop-verifier/SKILL.md",
  ".pi/skills/gh-issues/SKILL.md",
  ".pi/skills/gh-pr/SKILL.md",
  ".pi/skills/linear-graphql/SKILL.md",
  ".pi/skills/slack/SKILL.md",
  ".pi/agents/worker.md",
  ".pi/agents/reviewer.md",
  "loop/loop-driver.sh",
  "loop/worktree.sh",
  "loop/schedule/launchd.plist",
  "loop/schedule/systemd.timer",
  "loop/schedule/loop.yml",
  "loop/state/schema/heartbeat.schema.json",
  "loop/state/schema/round.schema.json",
  "loop/state/helpers.sh",
  "loop/guards/caps.sh",
  "loop/guards/denylist.txt",
  "loop/guards/circuit-breaker.sh",
  "loop/guards/README.md",
  ".github/workflows/loop-gate.yml",
  "patterns/registry.yaml",
  "patterns/registry.schema.json",
  "patterns/validate-registry.mjs",
  "tools/loop-readiness.mjs",
  "examples/first-loop/README.md",
  "examples/ship-pipeline/README.md",
];

test("AC1: every frozen path exists", () => {
  for (const rel of FROZEN_PATHS) {
    assert.ok(existsSync(p(rel)), `frozen path missing: ${rel}`);
  }
});

test("AC1: no STOP kill-switch file is shipped (shipping it would halt the loop by definition)", () => {
  assert.ok(!existsSync(p("loop/guards/STOP")), "loop/guards/STOP must NOT exist in the scaffold");
});

test("AC2: package.json shape — name/license/bin and the LITERAL 0.80.x pin", () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.name, "loopkit");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.bin["loopkit-readiness"], "tools/loop-readiness.mjs");
  // WHY literal "0.80.x": pi treats MINOR bumps as BREAKING. A caret (^0.80.0) would
  // silently pull a breaking 0.81; a tilde is also wrong here. The pin must be exact.
  const pin = pkg.dependencies["pi-coding-agent"];
  assert.equal(pin, "0.80.x", "pi-coding-agent must be pinned to literal 0.80.x");
  assert.ok(!pin.startsWith("^"), "pin must not use a caret range");
  assert.ok(!pin.startsWith("~"), "pin must not use a tilde range");
});

test("AC3: the loopkit-readiness bin runs, exits 0, and prints an L0 line", () => {
  // WHY: a scaffold bin that throws or exits non-zero breaks `npm install`/`npm link`
  // for every consumer. The L0 line proves it is the readiness placeholder, not a crash.
  const out = execFileSync(process.execPath, [p("tools/loop-readiness.mjs")], { encoding: "utf8" });
  assert.match(out, /L0/, "readiness output must contain L0");
  const src = readText("tools/loop-readiness.mjs");
  assert.ok(src.startsWith("#!/usr/bin/env node"), "bin must start with the node shebang");
  // executable bit
  assert.ok((lstatSync(p("tools/loop-readiness.mjs")).mode & 0o111) !== 0, "bin must be executable");
});

test("AC4: LICENSE is MIT with the 2026 loopkit contributors copyright line", () => {
  const lic = readText("LICENSE");
  assert.match(lic, /Permission is hereby granted, free of charge/);
  assert.match(lic, /Copyright \(c\) 2026 loopkit contributors/);
});

test("AC5: NOTICE names all three upstreams with their licenses + borrow-don't-depend", () => {
  const notice = readText("NOTICE");
  assert.match(notice, /pi/);
  assert.match(notice, /Mario Zechner/);
  assert.match(notice, /2025/);
  assert.match(notice, /openloop/i);
  assert.match(notice, /Apache/i);
  assert.match(notice, /loop-engineering/);
  assert.match(notice, /MIT/);
  // WHY: loopkit borrows mechanics by re-implementation; the statement makes the
  // no-runtime-dependency relationship explicit and discharges the courtesy obligation.
  assert.match(notice, /no runtime dependency|does NOT take a runtime|does not take a runtime/i);
});

test("AC6: README first screen sells the five moves, shouts the security warning, never auto-merge", () => {
  const r = readText("README.md").toLowerCase();
  for (const move of ["discovery", "handoff", "verification", "persistence", "scheduling"]) {
    assert.ok(r.includes(move), `README must name the move: ${move}`);
  }
  assert.ok(r.includes("full user permissions"), "README must warn: FULL user permissions");
  assert.ok(r.includes("no sandbox"), "README must warn: NO sandbox");
  assert.ok(r.includes("never auto-merge"), "README must state: never auto-merge");
  assert.ok(r.includes("docs/security.md"), "README must link docs/security.md");
});

test("AC7: CLAUDE.md is a symlink resolving to AGENTS.md (one memory file, two harnesses)", () => {
  assert.ok(lstatSync(p("CLAUDE.md")).isSymbolicLink(), "CLAUDE.md must be a symlink");
  assert.equal(readlinkSync(p("CLAUDE.md")), "AGENTS.md", "CLAUDE.md must point at AGENTS.md");
});

test("AC8: all STUB JSON parses; all STUB YAML parses; registry.yaml is the empty stub", () => {
  // JSON stubs (and the W0-0 schemas they live beside) must be valid JSON.
  for (const j of [
    "loop/state/schema/heartbeat.schema.json",
    "loop/state/schema/round.schema.json",
    "patterns/registry.schema.json",
  ]) {
    JSON.parse(readText(j)); // throws on invalid JSON
  }
  // YAML stubs must parse.
  for (const y of [".github/workflows/loop-gate.yml", "loop/schedule/loop.yml"]) {
    parseYaml(readText(y)); // throws on invalid YAML
  }
  const reg = parseYaml(readText("patterns/registry.yaml"));
  assert.deepEqual(reg, { schema_version: 1, findings: [] }, "registry.yaml must be the empty stub");
});

test("AC9: every STUB SKILL.md has YAML frontmatter with name + description", () => {
  const skills = [
    ".pi/skills/loop-verifier/SKILL.md",
    ".pi/skills/gh-issues/SKILL.md",
    ".pi/skills/gh-pr/SKILL.md",
    ".pi/skills/linear-graphql/SKILL.md",
    ".pi/skills/slack/SKILL.md",
  ];
  for (const s of skills) {
    const fm = frontmatter(readText(s));
    assert.ok(fm, `no frontmatter in ${s}`);
    const parsed = parseYaml(fm);
    // WHY: the Agent-Skills standard requires name + description; pi discovers a skill by
    // these keys. A missing key means pi cannot present the skill.
    assert.ok(parsed.name, `SKILL.md ${s} missing name`);
    assert.ok(parsed.description, `SKILL.md ${s} missing description`);
  }
});

test("AC10: worker + reviewer agents exist with frontmatter; reviewer notes model MUST differ", () => {
  const worker = readText(".pi/agents/worker.md");
  const reviewer = readText(".pi/agents/reviewer.md");
  assert.ok(parseYaml(frontmatter(worker)).name, "worker.md needs frontmatter name");
  const rfm = parseYaml(frontmatter(reviewer));
  assert.ok(rfm.name, "reviewer.md needs frontmatter name");
  assert.ok(rfm.model, "reviewer.md needs a model field (placeholder ok)");
  // WHY (generator ≠ evaluator): a model grading its own homework is not verification.
  assert.match(reviewer.toLowerCase(), /must differ/, "reviewer body must state its model MUST differ from the worker's");
});

test("AC11: no Lazio/private specifics anywhere in the tree", () => {
  // WHY: loopkit is public/MIT; a single private token would leak internal context.
  const banned = ["LAZ-", "laziopartners", "codex", "Fable"];
  const tracked = execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.startsWith("node_modules/"));
  for (const f of tracked) {
    let content;
    try {
      content = readFileSync(join(ROOT, f), "utf8");
    } catch {
      continue; // binary/symlink target unreadable as utf8 — skip
    }
    // Skip self: this test file legitimately lists the banned tokens as the denylist.
    if (f === "tools/scaffold.test.mjs") continue;
    for (const tok of banned) {
      assert.ok(!content.includes(tok), `banned token "${tok}" found in ${f}`);
    }
  }
});

test("AC12: loop-gate.yml is valid GitHub Actions YAML with at least one step", () => {
  const wf = parseYaml(readText(".github/workflows/loop-gate.yml"));
  assert.ok(wf.jobs, "workflow must define jobs");
  const firstJob = Object.values(wf.jobs)[0];
  assert.ok(Array.isArray(firstJob.steps) && firstJob.steps.length >= 1, "workflow must run at least one step");
});

// Extract a leading YAML frontmatter block (--- ... ---), tolerating a leading
// HTML comment line (our forward-pointing headers).
function frontmatter(text) {
  const m = text.match(/^(?:<!--[\s\S]*?-->\s*)?---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}
