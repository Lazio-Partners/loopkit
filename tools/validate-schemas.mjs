#!/usr/bin/env node
// loopkit schema validator (W0-0).
//
// This is the Tier-0 test harness. It proves:
//   (a) every *.valid.* fixture validates against its schema;
//   (b) the *.invalid.* fixture is REJECTED (a green run on it is a TEST FAILURE —
//       this exists so a future loosening of the schema fails CI, per the
//       "tests verify intent" rule);
//   (c) round.schema.json's $ref to verdict.schema.json resolves and a round whose
//       embedded verdict is a full valid verdict object passes;
//   (d) the shared ^LK-\d{4}$ id pattern rejects bad ids (ZZ-99 / lk-7 / LK-7)
//       identically across verdict.finding_id, round.finding_id, registry.id;
//   (e) patterns/registry.example.yaml parses as YAML and validates, with at least
//       one finding exercising every required field and one exercising the optional
//       extension fields.
//
// Exit 0 only if every expectation holds; otherwise exit 1 with a report.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const p = (...parts) => resolve(root, ...parts);
const readJson = (rel) => JSON.parse(readFileSync(p(rel), "utf8"));

const SCHEMAS = {
  verdict: "loop/state/schema/verdict.schema.json",
  heartbeat: "loop/state/schema/heartbeat.schema.json",
  round: "loop/state/schema/round.schema.json",
  registry: "patterns/registry.schema.json"
};

const results = [];
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    results.push(`  PASS  ${name}`);
  } else {
    failed += 1;
    results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// One Ajv instance with every schema registered so cross-schema $ref resolves.
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemaObjects = {};
for (const [name, rel] of Object.entries(SCHEMAS)) {
  const schema = readJson(rel);
  schemaObjects[name] = schema;
  ajv.addSchema(schema, schema.$id);
}

const validators = {};
for (const name of Object.keys(SCHEMAS)) {
  // Compiling against $id forces the $ref in round → verdict to resolve.
  validators[name] = ajv.getSchema(schemaObjects[name].$id);
  check(`${name}.schema.json compiles ($ref resolves)`, Boolean(validators[name]));
}

// (a) valid fixtures must validate.
const validFixtures = {
  verdict: "loop/state/schema/fixtures/verdict.valid.json",
  heartbeat: "loop/state/schema/fixtures/heartbeat.valid.json",
  round: "loop/state/schema/fixtures/round.valid.json"
};
for (const [name, rel] of Object.entries(validFixtures)) {
  const data = readJson(rel);
  const ok = validators[name](data);
  check(
    `${rel} validates against ${name}.schema.json`,
    ok,
    ok ? "" : ajv.errorsText(validators[name].errors)
  );
}

// (b) invalid fixture MUST be rejected — intent: if the schema stops rejecting it, fail.
{
  const data = readJson("loop/state/schema/fixtures/verdict.invalid.json");
  const ok = validators.verdict(data);
  check(
    "verdict.invalid.json is REJECTED (non-empty error list)",
    ok === false && Array.isArray(validators.verdict.errors) && validators.verdict.errors.length > 0,
    ok ? "schema accepted a known-bad fixture — the contract regressed" : ""
  );
}

// (c) $ref resolution proof: a round whose embedded verdict is broken must fail
// for a verdict-level reason (proves the $ref is actually applied, not ignored).
{
  const good = readJson("loop/state/schema/fixtures/round.valid.json");
  const broken = structuredClone(good);
  broken.verdict.confidence = 2; // out of [0,1] — a verdict-schema rule
  const ok = validators.round(broken);
  const cited = (validators.round.errors || []).some((e) =>
    String(e.instancePath).startsWith("/verdict")
  );
  check(
    "round.schema.json applies the embedded verdict schema via $ref",
    ok === false && cited,
    ok ? "round accepted an invalid embedded verdict" : "rejected, but not for a /verdict reason"
  );
}

// (d) shared ^LK-\d{4}$ pattern rejects bad ids across all three schemas.
// Wrong prefix, lowercase, and wrong digit-count — none match ^LK-\d{4}$.
const badIds = ["ZZ-99", "lk-7", "LK-7"];
for (const badId of badIds) {
  // verdict.finding_id
  {
    const data = readJson(validFixtures.verdict);
    data.finding_id = badId;
    check(`verdict.finding_id rejects "${badId}"`, validators.verdict(data) === false);
  }
  // round.finding_id
  {
    const data = readJson(validFixtures.round);
    data.finding_id = badId;
    check(`round.finding_id rejects "${badId}"`, validators.round(data) === false);
  }
  // registry.id
  {
    const reg = {
      schema_version: 1,
      findings: [
        {
          id: badId,
          title: "x",
          source: "manual",
          source_ref: "x",
          status: "open",
          priority: "p2",
          isolation: { branch: "b", worktree: "w" },
          acceptance: "x",
          detector: "x",
          created_at: "2026-06-25T00:00:00Z",
          updated_at: "2026-06-25T00:00:00Z"
        }
      ]
    };
    check(`registry.id rejects "${badId}"`, validators.registry(reg) === false);
  }
}

// (e) registry example YAML parses and validates; required-field finding + optional-field finding present.
{
  const text = readFileSync(p("patterns/registry.example.yaml"), "utf8");
  let reg;
  let parseOk = true;
  try {
    reg = parseYaml(text);
  } catch (err) {
    parseOk = false;
    check("registry.example.yaml parses as YAML", false, err.message);
  }
  if (parseOk) {
    check("registry.example.yaml parses as YAML", true);
    const ok = validators.registry(reg);
    check(
      "registry.example.yaml validates against registry.schema.json",
      ok,
      ok ? "" : ajv.errorsText(validators.registry.errors)
    );
    const findings = Array.isArray(reg?.findings) ? reg.findings : [];
    check(
      "registry.example.yaml has a finding exercising the optional extension fields",
      findings.some((f) => f.token_cost && f.week_one_mode && f.risk)
    );
    check(
      "registry.example.yaml has at least one finding with every required field",
      findings.some(
        (f) =>
          f.id &&
          f.title &&
          f.source &&
          f.source_ref &&
          f.status &&
          f.priority &&
          f.isolation &&
          f.acceptance &&
          f.detector &&
          f.created_at &&
          f.updated_at
      )
    );
  }
}

console.log("loopkit schema validation");
console.log(results.join("\n"));
const total = results.length;
console.log(`\n${total - failed}/${total} checks passed`);

if (failed > 0) {
  console.error(`\nFAIL: ${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nOK: all schema contracts hold.");
process.exit(0);
