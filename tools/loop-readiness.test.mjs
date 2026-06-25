import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runReadiness } from "./loop-readiness.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-readiness-"));
  for (const rel of ["package.json", "NOTICE", ".pi", "loop", "patterns", "tools"]) {
    cpSync(join(ROOT, rel), join(dir, rel), { recursive: true });
  }
  return dir;
}

test("readiness reports L2 for the source tree with structure and cost observability but no proven run", () => {
  const dir = fixture();
  const report = runReadiness(dir, { compatResult: { pass: true, output: "stub compat ok" } });
  assert.equal(report.level, "L2");
  assert.ok(report.gaps.some((gap) => gap.id === "proven-run"));
});

test("readiness refuses equal worker and reviewer models because the generator cannot grade itself", () => {
  const dir = fixture();
  writeFileSync(join(dir, ".pi/agents/reviewer.md"), `---
name: reviewer
description: reviewer
model: \${LOOPKIT_WORKER_MODEL}
---
body
`);
  const report = runReadiness(dir, { compatResult: { pass: true, output: "stub compat ok" } });
  assert.ok(report.gaps.some((gap) => gap.id === "different-models"));
});

test("readiness reaches L3 only when schema-valid state has log evidence and different models", () => {
  const dir = fixture();
  mkdirSync(join(dir, "loop/state/artifacts"), { recursive: true });
  mkdirSync(join(dir, "loop/state/logs"), { recursive: true });
  writeFileSync(join(dir, "loop/state/logs/round-001-tests.log"), "ok\n");
  writeFileSync(join(dir, "loop/state/heartbeat.json"), JSON.stringify({
    schema_version: 1,
    status: "idle",
    last_turn: 1,
    last_heartbeat: new Date().toISOString(),
    consecutive_failures: 0,
    max_consecutive_failures: 3,
    turns_today: 1,
    daily_cap: 8,
    tokens_today: 0,
    current_finding: null,
    halt_reason: null
  }, null, 2));
  const verdict = {
    schema_version: 1,
    finding_id: "LK-0001",
    verdict: "approve",
    confidence: 0.82,
    reviewer_model: "reviewer",
    worker_model: "worker",
    checks: {
      tests: { ran: true, passed: true, summary: "ok" },
      baseline: { ran: true, passed: true, summary: "ok" },
      app_drive: { ran: false, passed: true, summary: "not UI" }
    },
    findings: { good: ["ok"], bad: [], ugly: [], tests: ["npm test"] },
    blocking_reasons: [],
    human_checkpoint_required: true,
    next_action: "open_pr",
    evidence: [{ kind: "log", path: "loop/state/logs/round-001-tests.log" }]
  };
  writeFileSync(join(dir, "loop/state/artifacts/round-001.json"), JSON.stringify({
    schema_version: 1,
    round: 1,
    finding_id: "LK-0001",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    worktree: ".worktrees/feat-lk-0001",
    branch: "feat/lk-0001",
    worker: { model: "worker", tools_allowed: ["bash"], tokens: 0, stop_reason: "mock" },
    reviewer: { model: "reviewer", tokens: 0, stop_reason: "mock" },
    verdict,
    outcome: "approve",
    caps: { tokens_turn: 0, duration_s: 0, hit_cap: false },
    guard_events: [],
    error: null
  }, null, 2));
  const report = runReadiness(dir, { compatResult: { pass: true, output: "stub compat ok" } });
  assert.equal(report.level, "L3");
  assert.equal(report.gaps.length, 0);
});
