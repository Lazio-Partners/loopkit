#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEVELS = ["L0", "L1", "L2", "L3"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function exists(root, rel) {
  return existsSync(join(root, rel));
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  return match ? parseYaml(match[1]) : null;
}

function check(id, level, label, pass, detail, evidence = []) {
  return { id, level, label, pass, detail, evidence };
}

function runCompat(root, opts = {}) {
  if (opts.compatResult) return opts.compatResult;
  const res = spawnSync(process.execPath, [join(root, "tools/compat-check.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    pass: res.status === 0,
    exit_code: res.status,
    output: `${res.stdout}${res.stderr}`.trim()
  };
}

function schemaHasProperties(schema, names) {
  const props = schema?.properties ?? {};
  return names.every((name) => Object.hasOwn(props, name));
}

function schemaEnumIncludes(schema, path, values) {
  let node = schema;
  for (const part of path) node = node?.properties?.[part];
  return values.every((value) => node?.enum?.includes(value));
}

function validateAgainst(root, schemaRel, value) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const verdict = readJson(join(root, "loop/state/schema/verdict.schema.json"));
  ajv.addSchema(verdict, verdict.$id);
  return ajv.compile(readJson(join(root, schemaRel)))(value);
}

export function runReadiness(repoRoot = process.cwd(), opts = {}) {
  const root = resolve(repoRoot);
  const checks = [];
  const evidence = [];
  const gaps = [];

  const pkgPath = join(root, "package.json");
  const pkg = existsSync(pkgPath) ? readJson(pkgPath) : {};
  const pin = pkg.dependencies?.["pi-coding-agent"] ?? pkg.optionalDependencies?.["pi-coding-agent"];
  const compat = runCompat(root, opts);

  checks.push(check("compat", "L0", "pi compatibility check", compat.pass, compat.pass ? "compat-check passed" : "compat-check failed", [compat.output].filter(Boolean)));
  checks.push(check("pin", "L0", "package pin", pin === "0.80.x", `pi-coding-agent pin is ${pin ?? "<missing>"}`));
  const notice = exists(root, "NOTICE") ? readFileSync(join(root, "NOTICE"), "utf8") : "";
  checks.push(check("notice", "L0", "NOTICE attributions", /pi/i.test(notice) && /loop-engineering/i.test(notice), "NOTICE names pi and loop-engineering"));

  const workerPath = join(root, ".pi/agents/worker.md");
  const reviewerPath = join(root, ".pi/agents/reviewer.md");
  const workerFm = existsSync(workerPath) ? frontmatter(readFileSync(workerPath, "utf8")) : null;
  const reviewerFm = existsSync(reviewerPath) ? frontmatter(readFileSync(reviewerPath, "utf8")) : null;
  checks.push(check("agents", "L1", "worker and reviewer agents", Boolean(workerFm?.model && reviewerFm?.model), "worker/reviewer agent frontmatter is present"));
  checks.push(check("different-models", "L1", "generator differs from evaluator", Boolean(workerFm?.model && reviewerFm?.model && workerFm.model !== reviewerFm.model), "worker and reviewer model fields differ"));
  checks.push(check("verifier-skill", "L1", "verifier skill", exists(root, ".pi/skills/loop-verifier/SKILL.md"), "loop verifier skill exists"));
  for (const rel of ["loop/loop-driver.sh", "loop/worktree.sh", "loop/guards/denylist.txt", "loop/guards/caps.sh", "loop/guards/circuit-breaker.sh", "loop/state/schema/heartbeat.schema.json", "loop/state/schema/round.schema.json", "patterns/registry.yaml", "patterns/registry.schema.json"]) {
    checks.push(check(`path:${rel}`, "L1", rel, exists(root, rel), `${rel} exists`));
  }

  const heartbeatSchema = exists(root, "loop/state/schema/heartbeat.schema.json") ? readJson(join(root, "loop/state/schema/heartbeat.schema.json")) : {};
  const roundSchema = exists(root, "loop/state/schema/round.schema.json") ? readJson(join(root, "loop/state/schema/round.schema.json")) : {};
  checks.push(check("heartbeat-cost-fields", "L2", "heartbeat cost fields", schemaHasProperties(heartbeatSchema, ["consecutive_failures", "max_consecutive_failures", "daily_cap", "turns_today", "tokens_today", "status"]), "heartbeat schema represents failures, caps, tokens, and status"));
  checks.push(check("heartbeat-halt-status", "L2", "halt statuses", schemaEnumIncludes(heartbeatSchema, ["status"], ["blocked", "halted"]), "heartbeat status can represent blocked and halted"));
  checks.push(check("round-verdict-caps", "L2", "round verdict and caps", schemaHasProperties(roundSchema, ["verdict", "caps"]) && schemaHasProperties(roundSchema.properties?.caps ?? {}, ["tokens_turn", "duration_s", "hit_cap"]), "round schema records verdict and cap evidence"));
  const driverText = exists(root, "loop/loop-driver.sh") ? readFileSync(join(root, "loop/loop-driver.sh"), "utf8") + readFileSync(join(root, "tools/loop-driver-run.mjs"), "utf8") : "";
  checks.push(check("driver-stop", "L2", "driver kill-switch check", /STOP/.test(driverText) && /kill-switch/.test(driverText), "driver checks STOP before work"));

  const artifactsDir = join(root, "loop/state/artifacts");
  const roundFiles = existsSync(artifactsDir) ? readdirSync(artifactsDir).filter((name) => /^round-\d{3}\.json$/.test(name)) : [];
  const heartbeatPath = join(root, "loop/state/heartbeat.json");
  let provenRun = false;
  let provenDetail = "run activity unproven";
  if (roundFiles.length && existsSync(heartbeatPath)) {
    try {
      const round = readJson(join(artifactsDir, roundFiles[0]));
      const heartbeat = readJson(heartbeatPath);
      const roundValid = validateAgainst(root, "loop/state/schema/round.schema.json", round);
      const heartbeatOk = heartbeat.last_turn >= 1 && !Number.isNaN(Date.parse(heartbeat.last_heartbeat));
      const modelsDiffer = round?.verdict?.reviewer_model && round.verdict.reviewer_model !== round.verdict.worker_model;
      const logEvidence = (round?.verdict?.evidence ?? []).some((item) => item.path && existsSync(join(root, item.path)));
      provenRun = roundValid && heartbeatOk && modelsDiffer && logEvidence;
      provenDetail = provenRun ? `proven by ${roundFiles[0]}` : "state files exist but do not prove a run";
    } catch (err) {
      provenDetail = `state parse failed: ${err.message}`;
    }
  }
  checks.push(check("proven-run", "L3", "proven run activity", provenRun, provenDetail));

  const levels = {};
  for (const level of LEVELS) {
    levels[level] = checks.filter((item) => item.level === level).every((item) => item.pass);
  }
  let achieved = "L0";
  for (const level of LEVELS) {
    if (LEVELS.slice(0, LEVELS.indexOf(level) + 1).every((l) => levels[l])) achieved = level;
  }
  for (const item of checks) {
    if (!item.pass) gaps.push({ id: item.id, level: item.level, detail: item.detail });
    if (item.evidence?.length) evidence.push(...item.evidence);
  }
  return { level: achieved, levels, checks, gaps, evidence, compat };
}

function parseArgs(argv) {
  const args = { repo: process.cwd(), json: false, require: process.env.LOOPKIT_READINESS_MIN ?? "L1" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--repo") {
      args.repo = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--require") {
      args.require = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const report = runReadiness(args.repo);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Readiness: ${report.level} / L3`);
    for (const item of report.checks) {
      console.log(`${item.pass ? "PASS" : "FAIL"} ${item.level} ${item.id}: ${item.detail}`);
    }
    if (report.gaps.length) {
      console.log("\nGaps:");
      report.gaps.forEach((gap, index) => console.log(`${index + 1}. ${gap.level} ${gap.id}: ${gap.detail}`));
    }
  }
  const requiredIndex = LEVELS.indexOf(args.require);
  const achievedIndex = LEVELS.indexOf(report.level);
  process.exit(achievedIndex >= requiredIndex ? 0 : 1);
}
