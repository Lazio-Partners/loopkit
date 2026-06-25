#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMMAND_TOKEN = /^[A-Za-z0-9_./:@%+=,-]+$/;
const runtimeContext = {};

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replaceAll("-", "_");
      opts[key] = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env ?? {}) },
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
}

function configuredCommandArgv(command, label) {
  const text = String(command ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  if (/[;&|`$<>\\\n\r]/.test(text)) {
    throw new Error(`${label} contains shell metacharacters; use a simple argv-safe command`);
  }
  const argv = text.split(/\s+/);
  for (const token of argv) {
    if (!COMMAND_TOKEN.test(token)) {
      throw new Error(`${label} contains an unsupported token: ${token}`);
    }
  }
  return argv;
}

function runConfiguredCommand(command, cwd, label) {
  const [cmd, ...args] = configuredCommandArgv(command, label);
  return run(cmd, args, { cwd, capture: true });
}

function loadJson(relOrAbs) {
  return JSON.parse(readFileSync(resolve(ROOT, relOrAbs), "utf8"));
}

function buildValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const verdict = loadJson("loop/state/schema/verdict.schema.json");
  const round = loadJson("loop/state/schema/round.schema.json");
  ajv.addSchema(verdict, verdict.$id);
  return {
    round: ajv.compile(round),
    verdict: ajv.compile(verdict)
  };
}

function lastVerdictBlock(text) {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (!blocks.length) throw new Error("reviewer output contains no fenced json verdict block");
  return JSON.parse(blocks.at(-1)[1]);
}

function iso() {
  return new Date().toISOString();
}

function isoDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
}

function dailyReset(previous) {
  if (!previous) return null;
  const lastDay = isoDay(previous.last_heartbeat);
  const today = isoDay(iso());
  if (lastDay && today && lastDay !== today) {
    return { ...previous, turns_today: 0, tokens_today: 0 };
  }
  return previous;
}

function numberFromEnv(name, fallback = 0) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
  return parsed;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readHeartbeat(stateDir) {
  const path = join(stateDir, "heartbeat.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeHeartbeat(stateDir, patch = {}) {
  const previous = dailyReset(readHeartbeat(stateDir));
  const heartbeat = {
    schema_version: 1,
    status: "idle",
    last_turn: 0,
    last_heartbeat: iso(),
    consecutive_failures: 0,
    max_consecutive_failures: Number(process.env.LOOPKIT_MAX_CONSECUTIVE_FAILURES ?? 3),
    turns_today: 0,
    daily_cap: Number(process.env.LOOPKIT_DAILY_CAP ?? 8),
    tokens_today: 0,
    current_finding: null,
    halt_reason: null,
    ...(previous ?? {}),
    ...patch,
    last_heartbeat: iso()
  };
  writeJson(join(stateDir, "heartbeat.json"), heartbeat);
  return heartbeat;
}

function nextRound(stateDir) {
  const dir = join(stateDir, "artifacts");
  ensureDir(dir);
  return String(readdirSync(dir).filter((name) => /^round-\d{3}\.json$/.test(name)).length + 1).padStart(3, "0");
}

function updateRegistry(registryPath, id, patch) {
  const doc = parseYaml(readFileSync(registryPath, "utf8"));
  const finding = doc.findings.find((item) => item.id === id);
  if (!finding) throw new Error(`registry finding not found: ${id}`);
  Object.assign(finding, patch, { updated_at: iso() });
  writeFileSync(registryPath, stringifyYaml(doc));
}

function relativeDisplay(root, path) {
  const rel = relative(root, path);
  return rel && !rel.startsWith("..") ? rel : path;
}

function addBlockingReason(verdict, reason) {
  if (!verdict.blocking_reasons.includes(reason)) verdict.blocking_reasons.push(reason);
}

function downgradeVerdict(verdict, reason) {
  verdict.verdict = "needs_changes";
  verdict.next_action = "return_to_worker";
  verdict.human_checkpoint_required = true;
  addBlockingReason(verdict, reason);
}

function createFallbackVerdict({ finding, testResult, testCommand, before, after, workerModel, reviewerModel, testLog, branch }) {
  const testsPassed = testResult.status === 0;
  return {
    schema_version: 1,
    finding_id: finding.id,
    verdict: testsPassed ? "approve" : "needs_changes",
    confidence: testsPassed ? 0.82 : 0.4,
    reviewer_model: reviewerModel,
    worker_model: workerModel,
    checks: {
      tests: { ran: true, passed: testsPassed, summary: testCommand },
      baseline: { ran: true, passed: before.status !== after.status, summary: "detector state changed across the turn" },
      app_drive: { ran: false, passed: true, summary: "not a UI finding" }
    },
    findings: { good: [], bad: testsPassed ? [] : ["tests failed"], ugly: [], tests: [testCommand] },
    blocking_reasons: testsPassed ? [] : ["deterministic floor failed"],
    human_checkpoint_required: true,
    next_action: testsPassed ? "open_pr" : "return_to_worker",
    evidence: [{ kind: "log", path: relativeDisplay(ROOT, testLog) }, { kind: "diff", ref: branch }]
  };
}

function enforceVerdictRules({ verdict, finding, testResult, testCommand }) {
  if (verdict.finding_id !== finding.id) {
    throw new Error(`verdict finding_id ${verdict.finding_id} does not match active finding ${finding.id}`);
  }
  if (verdict.reviewer_model === verdict.worker_model) {
    throw new Error("verdict invalid: reviewer_model must differ from worker_model");
  }

  verdict.checks.tests.ran = true;
  verdict.checks.tests.passed = testResult.status === 0;
  verdict.checks.tests.summary = verdict.checks.tests.summary
    ? `${verdict.checks.tests.summary}; driver command: ${testCommand}`
    : `driver command: ${testCommand}`;

  if (verdict.verdict === "approve" && verdict.findings.good.length > 0 && verdict.evidence.length === 0) {
    downgradeVerdict(verdict, "good findings require evidence before approval");
  }
  if (testResult.status !== 0) {
    downgradeVerdict(verdict, "driver test command failed");
  }
  if (verdict.verdict === "approve" && (verdict.findings.bad.length || verdict.confidence < 0.5)) {
    downgradeVerdict(verdict, "reviewer verdict did not meet approval gates");
  }
  if (
    verdict.verdict === "approve" &&
    (verdict.human_checkpoint_required !== true || verdict.next_action !== "open_pr")
  ) {
    downgradeVerdict(verdict, "approval requires human_checkpoint_required=true and next_action=open_pr");
  }
  return verdict.verdict;
}

function writeProgress({ stateDir, roundNo, endedAt, findingId, outcome, branch, worktreeRel, workerModel, reviewerModel, nextAction, error }) {
  const progress = [
    `## Round ${roundNo} \u2014 ${endedAt} \u2014 ${findingId} \u2014 ${outcome}`,
    `- branch: ${branch}`,
    `- worktree: ${worktreeRel}`,
    `- worker_model: ${workerModel}`,
    `- reviewer_model: ${reviewerModel}`,
    `- verdict: ${outcome}`,
    `- next_action: ${nextAction}`,
    error ? `- error: ${error}` : "- No PR merged - human checkpoint required.",
    ""
  ].join("\n");
  writeFileSync(join(stateDir, "progress.md"), progress, { flag: "a" });
}

function errorRound({ message }) {
  const {
    finding,
    roundNumber,
    startedAt,
    worktreeRel,
    branch,
    workerModel,
    reviewerModel
  } = runtimeContext;
  return {
    schema_version: 1,
    round: roundNumber,
    finding_id: finding.id,
    started_at: startedAt ?? iso(),
    ended_at: iso(),
    worktree: worktreeRel ?? "",
    branch: branch ?? "",
    worker: {
      model: workerModel ?? "worker-model",
      tools_allowed: ["read", "write", "edit", "bash"],
      tokens: 0,
      stop_reason: "error"
    },
    reviewer: {
      model: reviewerModel ?? "reviewer-model",
      tokens: 0,
      stop_reason: "error"
    },
    verdict: {
      schema_version: 1,
      finding_id: finding.id,
      verdict: "needs_changes",
      confidence: 0,
      reviewer_model: reviewerModel ?? "reviewer-model",
      worker_model: workerModel ?? "worker-model",
      checks: {
        tests: { ran: false, passed: false, summary: "driver failed before deterministic floor completed" },
        baseline: { ran: false, passed: false, summary: "driver error" },
        app_drive: { ran: false, passed: true, summary: "not run" }
      },
      findings: { good: [], bad: [message], ugly: [], tests: [] },
      blocking_reasons: [message],
      human_checkpoint_required: true,
      next_action: "return_to_worker",
      evidence: []
    },
    outcome: "error",
    caps: {
      tokens_turn: 0,
      duration_s: 0,
      hit_cap: false
    },
    guard_events: [],
    error: message
  };
}

function recordDriverFailure(err) {
  const message = err?.message ?? String(err);
  const { stateDir, registryPath, finding, roundNo, roundNumber, turnsTodayStart } = runtimeContext;
  if (!stateDir) return;
  try {
    const previous = readHeartbeat(stateDir) ?? {};
    if (finding && registryPath) {
      updateRegistry(registryPath, finding.id, {
        status: "needs_changes",
        assigned_turn: null,
        verdict_round: roundNumber ?? previous.last_turn ?? 0
      });
    }
    if (finding && roundNo && roundNumber) {
      const artifact = join(stateDir, "artifacts", `round-${roundNo}.json`);
      if (!existsSync(artifact)) {
        const round = errorRound({ message });
        writeJson(artifact, round);
        writeProgress({
          stateDir,
          roundNo,
          endedAt: round.ended_at,
          findingId: finding.id,
          outcome: "error",
          branch: runtimeContext.branch ?? "",
          worktreeRel: runtimeContext.worktreeRel ?? "",
          workerModel: runtimeContext.workerModel ?? "worker-model",
          reviewerModel: runtimeContext.reviewerModel ?? "reviewer-model",
          nextAction: "return_to_worker",
          error: message
        });
      }
    }
    writeHeartbeat(stateDir, {
      status: "idle",
      current_finding: null,
      last_turn: roundNumber ?? previous.last_turn ?? 0,
      turns_today: finding ? (turnsTodayStart ?? previous.turns_today ?? 0) + 1 : previous.turns_today ?? 0,
      consecutive_failures: (previous.consecutive_failures ?? 0) + 1,
      halt_reason: message
    });
  } catch (recordErr) {
    console.error(`loop-driver: failed to record driver error: ${recordErr.message}`);
  }
}

function printHelp() {
  console.log(`usage: loop/loop-driver.sh [options]

Options may also be provided with LOOPKIT_* environment variables.
  --registry PATH          registry YAML (default patterns/registry.yaml)
  --state-dir PATH         state directory (default loop/state)
  --target-repo PATH       git repo to work on (default current repo)
  --mode dry-run|live      dry-run applies a provided patch and reviewer output
  --worker-patch PATH      patch applied in dry-run mode
  --reviewer-output PATH   reviewer output fixture containing a fenced JSON block
  --test-command CMD       deterministic floor command (default npm test)
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const registryPath = resolve(ROOT, args.registry ?? process.env.LOOPKIT_REGISTRY ?? "patterns/registry.yaml");
  const stateDir = resolve(ROOT, args.state_dir ?? process.env.LOOPKIT_STATE_DIR ?? "loop/state");
  const targetRepo = resolve(ROOT, args.target_repo ?? process.env.LOOPKIT_TARGET_REPO ?? ".");
  const guardDir = resolve(ROOT, args.guard_dir ?? process.env.LOOPKIT_GUARD_DIR ?? "loop/guards");
  const mode = args.mode ?? process.env.LOOPKIT_MODE ?? "dry-run";
  const workerModel = args.worker_model ?? process.env.LOOPKIT_WORKER_MODEL ?? "worker-model";
  const reviewerModel = args.reviewer_model ?? process.env.LOOPKIT_REVIEWER_MODEL ?? "reviewer-model";
  const testCommand = args.test_command ?? process.env.LOOPKIT_TEST_COMMAND ?? "npm test";
  const tokenBudget = numberFromEnv("LOOPKIT_TOKEN_BUDGET_PER_DAY", 0);
  const tokenEstimate = numberFromEnv("LOOPKIT_TOKEN_ESTIMATE_PER_TURN", 0);
  Object.assign(runtimeContext, { registryPath, stateDir, targetRepo, guardDir, workerModel, reviewerModel });

  ensureDir(join(stateDir, "artifacts"));
  ensureDir(join(stateDir, "logs"));

  if (existsSync(join(guardDir, "STOP"))) {
    writeHeartbeat(stateDir, { status: "halted", halt_reason: "kill-switch present" });
    console.log("loop-driver: halted: kill-switch present");
    return 0;
  }

  if (workerModel === reviewerModel) {
    writeHeartbeat(stateDir, { status: "blocked", halt_reason: "worker and reviewer models are equal" });
    console.error("loop-driver: reviewer model must differ from worker model");
    return 65;
  }

  const heartbeat = writeHeartbeat(stateDir, { status: "running" });
  Object.assign(runtimeContext, {
    turnsTodayStart: heartbeat.turns_today,
    tokensTodayStart: heartbeat.tokens_today
  });
  if (heartbeat.turns_today >= heartbeat.daily_cap) {
    writeHeartbeat(stateDir, { status: "halted", halt_reason: "daily cap reached" });
    console.log("loop-driver: halted: daily cap reached");
    return 0;
  }
  if (tokenBudget > 0 && tokenEstimate > 0 && heartbeat.tokens_today + tokenEstimate > tokenBudget) {
    writeHeartbeat(stateDir, { status: "halted", halt_reason: "token budget reached" });
    console.log("loop-driver: halted: token budget reached");
    return 0;
  }
  if (heartbeat.consecutive_failures >= heartbeat.max_consecutive_failures) {
    writeHeartbeat(stateDir, { status: "halted", halt_reason: "circuit breaker open" });
    console.log("loop-driver: halted: circuit breaker open");
    return 0;
  }

  const registry = parseYaml(readFileSync(registryPath, "utf8"));
  const finding = registry.findings.find((item) => item.status === "open" || item.status === "needs_changes");
  if (!finding) {
    writeHeartbeat(stateDir, { status: "idle", halt_reason: "no open findings" });
    console.log("loop-driver: no open findings");
    return 0;
  }

  const roundNo = nextRound(stateDir);
  const roundNumber = Number(roundNo);
  const branch = finding.isolation?.branch ?? `feat/${finding.id.toLowerCase()}`;
  const worktreeRel = finding.isolation?.worktree ?? `.worktrees/${branch.replaceAll("/", "-")}`;
  const startedAt = iso();
  Object.assign(runtimeContext, { finding, roundNo, roundNumber, branch, worktreeRel, startedAt });

  writeHeartbeat(stateDir, {
    status: "running",
    current_finding: finding.id,
    last_turn: roundNumber
  });
  updateRegistry(registryPath, finding.id, { status: "in_progress", assigned_turn: roundNumber });

  const before = runConfiguredCommand(finding.detector, targetRepo, "finding.detector");
  const worktreeOut = run("bash", [join(ROOT, "loop/worktree.sh"), "--repo", targetRepo, "--branch", branch, "--worktree", worktreeRel], { capture: true });
  if (worktreeOut.status !== 0) {
    throw new Error(worktreeOut.stderr || "worktree creation failed");
  }
  const worktreeDir = worktreeOut.stdout.match(/WORKTREE_DIR=(.*)/)?.[1]?.trim();
  if (!worktreeDir) throw new Error("worktree wrapper did not print WORKTREE_DIR");

  const workerPatch = args.worker_patch ?? process.env.LOOPKIT_WORKER_PATCH;
  if (mode === "dry-run" && workerPatch) {
    const applied = run("git", ["apply", "--whitespace=nowarn", resolve(ROOT, workerPatch)], { cwd: worktreeDir, capture: true });
    if (applied.status !== 0) throw new Error(applied.stderr || "worker patch failed to apply");
  }

  const testLog = join(stateDir, "logs", `round-${roundNo}-tests.log`);
  const testResult = runConfiguredCommand(testCommand, worktreeDir, "test command");
  writeFileSync(testLog, `${testResult.stdout ?? ""}${testResult.stderr ?? ""}`);
  const after = runConfiguredCommand(finding.detector, worktreeDir, "finding.detector");

  const reviewerOutputPath = args.reviewer_output ?? process.env.LOOPKIT_REVIEWER_OUTPUT;
  let verdict;
  if (reviewerOutputPath) {
    verdict = lastVerdictBlock(readFileSync(resolve(ROOT, reviewerOutputPath), "utf8"));
  } else if (mode !== "dry-run") {
    throw new Error("live mode requires real reviewer output");
  } else {
    verdict = createFallbackVerdict({ finding, testResult, testCommand, before, after, workerModel, reviewerModel, testLog, branch });
  }
  verdict.worker_model = verdict.worker_model || workerModel;
  verdict.reviewer_model = verdict.reviewer_model || reviewerModel;

  const v = buildValidators();
  runtimeContext.validators = v;
  if (!v.verdict(verdict)) {
    throw new Error(`verdict failed schema validation: ${JSON.stringify(v.verdict.errors)}`);
  }
  const outcome = enforceVerdictRules({ verdict, finding, testResult, testCommand });
  if (!v.verdict(verdict)) {
    throw new Error(`verdict failed schema validation after driver gates: ${JSON.stringify(v.verdict.errors)}`);
  }

  const endedAt = iso();
  const round = {
    schema_version: 1,
    round: roundNumber,
    finding_id: finding.id,
    started_at: startedAt,
    ended_at: endedAt,
    worktree: worktreeRel,
    branch,
    worker: {
      model: workerModel,
      tools_allowed: ["read", "write", "edit", "bash"],
      tokens: 0,
      stop_reason: mode === "dry-run" ? "mock" : "stop"
    },
    reviewer: {
      model: reviewerModel,
      tokens: 0,
      stop_reason: mode === "dry-run" ? "mock" : "stop"
    },
    verdict,
    outcome,
    caps: {
      tokens_turn: tokenEstimate,
      duration_s: Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
      hit_cap: false
    },
    guard_events: [],
    error: null
  };

  if (!v.round(round)) {
    throw new Error(`round failed schema validation: ${JSON.stringify(v.round.errors)}`);
  }
  writeJson(join(stateDir, "artifacts", `round-${roundNo}.json`), round);
  writeProgress({
    stateDir,
    roundNo,
    endedAt,
    findingId: finding.id,
    outcome,
    branch,
    worktreeRel,
    workerModel,
    reviewerModel,
    nextAction: verdict.next_action
  });

  updateRegistry(registryPath, finding.id, {
    status: outcome === "approve" && verdict.next_action === "open_pr" ? "in_review" : "needs_changes",
    assigned_turn: null,
    verdict_round: roundNumber
  });
  writeHeartbeat(stateDir, {
    status: "idle",
    current_finding: null,
    last_turn: roundNumber,
    turns_today: heartbeat.turns_today + 1,
    tokens_today: heartbeat.tokens_today + tokenEstimate,
    consecutive_failures: outcome === "approve" ? 0 : heartbeat.consecutive_failures + 1,
    halt_reason: null
  });

  if (verdict.next_action === "open_pr") {
    console.log(`loop-driver: prepared PR command: gh pr create --base main --head ${branch}`);
  }
  console.log(`loop-driver: round ${roundNo} complete for ${finding.id}: ${outcome}`);
  return outcome === "approve" ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    recordDriverFailure(err);
    console.error(`loop-driver: ${err.message}`);
    process.exit(1);
  });
