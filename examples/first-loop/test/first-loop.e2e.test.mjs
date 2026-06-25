import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const ROOT = new URL("../../..", import.meta.url).pathname;
const EXAMPLE = join(ROOT, "examples/first-loop");

function tempExample() {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-first-loop-"));
  cpSync(EXAMPLE, dir, { recursive: true });
  return dir;
}

function runFirstLoop(dir, env = {}) {
  return spawnSync("bash", [join(ROOT, "examples/first-loop/run-first-loop.sh")], {
    cwd: ROOT,
    env: { ...process.env, LOOPKIT_EXAMPLE_ROOT: dir, ...env },
    encoding: "utf8"
  });
}

function seedSandbox(dir) {
  const sandbox = join(dir, "sandbox");
  if (existsSync(join(sandbox, ".git"))) return;
  assert.equal(spawnSync("git", ["-C", sandbox, "init", "-b", "main"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("git", ["-C", sandbox, "config", "user.email", "loopkit@example.test"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("git", ["-C", sandbox, "config", "user.name", "loopkit example"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("git", ["-C", sandbox, "add", "package.json", "src/slugify.js", "test/slugify.test.js"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync("git", ["-C", sandbox, "commit", "-m", "seed first-loop sandbox"], { encoding: "utf8" }).status, 0);
}

function runDriverDirect(dir, args = [], env = {}) {
  seedSandbox(dir);
  return spawnSync("bash", [join(ROOT, "loop/loop-driver.sh"), ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      PI_OFFLINE: "1",
      PI_SKIP_VERSION_CHECK: "1",
      LOOPKIT_REGISTRY: join(dir, "patterns/registry.yaml"),
      LOOPKIT_STATE_DIR: join(dir, "loop/state"),
      LOOPKIT_TARGET_REPO: join(dir, "sandbox"),
      LOOPKIT_WORKER_MODEL: "first-loop-worker-model",
      LOOPKIT_REVIEWER_MODEL: "first-loop-reviewer-model",
      LOOPKIT_WORKER_PATCH: join(dir, "mocks/worker-patch.diff"),
      LOOPKIT_TEST_COMMAND: "npm test",
      ...env
    },
    encoding: "utf8"
  });
}

function baseVerdict(patch = {}) {
  return {
    schema_version: 1,
    finding_id: "LK-0001",
    verdict: "approve",
    confidence: 0.82,
    reviewer_model: "first-loop-reviewer-model",
    worker_model: "first-loop-worker-model",
    checks: {
      tests: { ran: true, passed: true, summary: "npm test passed" },
      baseline: { ran: true, passed: true, summary: "detector failed before and passed after" },
      app_drive: { ran: false, passed: true, summary: "non-UI example" }
    },
    findings: {
      good: ["slugify now trims and collapses whitespace."],
      bad: [],
      ugly: ["Human review is still required before merge."],
      tests: ["npm test"]
    },
    blocking_reasons: [],
    human_checkpoint_required: true,
    next_action: "open_pr",
    evidence: [
      { kind: "log", path: "examples/first-loop/loop/state/logs/round-001-tests.log" },
      { kind: "diff", ref: "feat/lk-0001" }
    ],
    ...patch
  };
}

function writeReviewerOutput(dir, verdict) {
  const path = join(dir, "reviewer-output.txt");
  writeFileSync(path, `Review complete.\n\n\`\`\`json\n${JSON.stringify(verdict, null, 2)}\n\`\`\`\n`);
  return path;
}

function readRegistry(dir) {
  return parseYaml(readFileSync(join(dir, "patterns/registry.yaml"), "utf8"));
}

function mutateRegistry(dir, fn) {
  const path = join(dir, "patterns/registry.yaml");
  const doc = parseYaml(readFileSync(path, "utf8"));
  fn(doc);
  writeFileSync(path, stringifyYaml(doc));
}

test("first-loop mock run proves all five moves and never auto-merges", () => {
  const dir = tempExample();
  const res = runFirstLoop(dir);
  assert.equal(res.status, 0, res.stderr);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.finding_id, "LK-0001");
  assert.equal(round.branch, "feat/lk-0001");
  assert.notEqual(round.worker.model, round.reviewer.model);
  assert.equal(round.verdict.next_action, "open_pr");
  assert.equal(round.verdict.human_checkpoint_required, true);
  const progress = readFileSync(join(dir, "loop/state/progress.md"), "utf8");
  assert.match(progress, /^## Round 001 \u2014 \d{4}-\d{2}-\d{2}T.*Z \u2014 LK-0001 \u2014 approve/m);
  assert.match(progress, /No PR merged/);
  assert.equal(existsSync(join(dir, ".worktrees/feat-lk-0001")), true);
  const sandboxTest = spawnSync("npm", ["test"], { cwd: join(dir, ".worktrees/feat-lk-0001"), encoding: "utf8" });
  assert.equal(sandboxTest.status, 0, sandboxTest.stderr);
});

test("first-loop kill-switch halts before any subagent-style work", () => {
  const dir = tempExample();
  mkdirSync(join(dir, "loop/guards"), { recursive: true });
  writeFileSync(join(dir, "loop/guards/STOP"), "stop\n");
  const res = runFirstLoop(dir, { LOOPKIT_GUARD_DIR: join(dir, "loop/guards") });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /halted/);
});

test("first-loop resets daily counters when the stored heartbeat is from a previous day", () => {
  const dir = tempExample();
  mkdirSync(join(dir, "loop/state"), { recursive: true });
  writeFileSync(join(dir, "loop/state/heartbeat.json"), JSON.stringify({
    schema_version: 1,
    status: "idle",
    last_turn: 7,
    last_heartbeat: "2026-01-01T00:00:00.000Z",
    consecutive_failures: 0,
    max_consecutive_failures: 3,
    turns_today: 1,
    daily_cap: 1,
    tokens_today: 100,
    current_finding: null,
    halt_reason: null
  }));
  const res = runFirstLoop(dir);
  assert.equal(res.status, 0, res.stderr);
  const heartbeat = JSON.parse(readFileSync(join(dir, "loop/state/heartbeat.json"), "utf8"));
  assert.equal(heartbeat.turns_today, 1);
  assert.equal(heartbeat.tokens_today, 0);
});

test("first-loop halts before work when the configured token budget would be exceeded", () => {
  const dir = tempExample();
  mkdirSync(join(dir, "loop/state"), { recursive: true });
  writeFileSync(join(dir, "loop/state/heartbeat.json"), JSON.stringify({
    schema_version: 1,
    status: "idle",
    last_turn: 0,
    last_heartbeat: new Date().toISOString(),
    consecutive_failures: 0,
    max_consecutive_failures: 3,
    turns_today: 0,
    daily_cap: 1,
    tokens_today: 95,
    current_finding: null,
    halt_reason: null
  }));
  const res = runFirstLoop(dir, {
    LOOPKIT_TOKEN_BUDGET_PER_DAY: "100",
    LOOPKIT_TOKEN_ESTIMATE_PER_TURN: "10"
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /token budget/);
  assert.equal(existsSync(join(dir, "loop/state/artifacts/round-001.json")), false);
});

test("first-loop rejects reviewer output for a different finding and records a recoverable error", () => {
  const dir = tempExample();
  const reviewer = writeReviewerOutput(dir, baseVerdict({ finding_id: "LK-9999" }));
  const res = runFirstLoop(dir, { LOOPKIT_REVIEWER_OUTPUT: reviewer });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /does not match active finding/);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.outcome, "error");
  const registry = readRegistry(dir);
  assert.equal(registry.findings[0].status, "needs_changes");
  assert.equal(registry.findings[0].assigned_turn, null);
  const heartbeat = JSON.parse(readFileSync(join(dir, "loop/state/heartbeat.json"), "utf8"));
  assert.equal(heartbeat.status, "idle");
});

test("first-loop trusts the executed test command over reviewer JSON", () => {
  const dir = tempExample();
  const reviewer = writeReviewerOutput(dir, baseVerdict());
  const res = runDriverDirect(dir, [
    "--registry", join(dir, "patterns/registry.yaml"),
    "--state-dir", join(dir, "loop/state"),
    "--target-repo", join(dir, "sandbox"),
    "--mode", "dry-run",
    "--reviewer-output", reviewer,
    "--test-command", "node missing-test.mjs"
  ]);
  assert.notEqual(res.status, 0);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.outcome, "needs_changes");
  assert.equal(round.verdict.checks.tests.passed, false);
  assert.equal(round.verdict.next_action, "return_to_worker");
  assert.match(round.verdict.blocking_reasons.join("\n"), /driver test command failed/);
});

test("first-loop live mode requires real reviewer output", () => {
  const dir = tempExample();
  const res = runDriverDirect(dir, [
    "--registry", join(dir, "patterns/registry.yaml"),
    "--state-dir", join(dir, "loop/state"),
    "--target-repo", join(dir, "sandbox"),
    "--mode", "live",
    "--worker-patch", join(dir, "mocks/worker-patch.diff"),
    "--test-command", "npm test"
  ]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /live mode requires real reviewer output/);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.outcome, "error");
});

test("first-loop refuses detector shell metacharacters without executing them", () => {
  const dir = tempExample();
  const marker = join(dir, "detector-pwned");
  mutateRegistry(dir, (doc) => {
    doc.findings[0].detector = `npm test; touch ${marker}`;
  });
  const res = runFirstLoop(dir);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /shell metacharacters/);
  assert.equal(existsSync(marker), false);
  assert.equal(readRegistry(dir).findings[0].status, "needs_changes");
});

test("first-loop downgrades approvals that are missing evidence for good findings", () => {
  const dir = tempExample();
  const reviewer = writeReviewerOutput(dir, baseVerdict({ evidence: [] }));
  const res = runFirstLoop(dir, { LOOPKIT_REVIEWER_OUTPUT: reviewer });
  assert.notEqual(res.status, 0);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.outcome, "needs_changes");
  assert.match(round.verdict.blocking_reasons.join("\n"), /good findings require evidence/);
});

test("first-loop downgrades approvals without the required human checkpoint", () => {
  const dir = tempExample();
  const reviewer = writeReviewerOutput(dir, baseVerdict({
    human_checkpoint_required: false,
    next_action: "park"
  }));
  const res = runFirstLoop(dir, { LOOPKIT_REVIEWER_OUTPUT: reviewer });
  assert.notEqual(res.status, 0);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.outcome, "needs_changes");
  assert.equal(round.verdict.human_checkpoint_required, true);
  assert.equal(round.verdict.next_action, "return_to_worker");
  assert.match(round.verdict.blocking_reasons.join("\n"), /approval requires/);
});
