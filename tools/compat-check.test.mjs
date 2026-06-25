#!/usr/bin/env node
// Unit test for tools/compat-check.mjs (W0-0).
//
// Forces a fake installed pi version via LOOPKIT_FAKE_PI_VERSION and asserts the
// gate HARD FAILS (exit non-zero) on a MAJOR.MINOR mismatch with the documented
// remediation string. Encodes intent: if compat-check ever stops rejecting a wrong
// pi version, this test fails.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compatCheck = resolve(__dirname, "compat-check.mjs");

const REMEDIATION = "Pin or update loopkit, do not run untested.";
let failures = 0;
const log = [];

function assert(name, cond, detail = "") {
  if (cond) {
    log.push(`  PASS  ${name}`);
  } else {
    failures += 1;
    log.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function run(fakeVersion) {
  return spawnSync(process.execPath, [compatCheck], {
    encoding: "utf8",
    env: { ...process.env, LOOPKIT_FAKE_PI_VERSION: fakeVersion }
  });
}

// 1. Wrong MINOR (0.81) must hard-fail with the remediation string.
{
  const r = run("0.81.0");
  const combined = `${r.stdout || ""}${r.stderr || ""}`;
  assert("fake pi 0.81.0 exits non-zero", r.status !== 0, `exit=${r.status}`);
  assert("fake pi 0.81.0 prints the remediation string", combined.includes(REMEDIATION));
  assert(
    "output shows pinned-vs-installed versions",
    combined.includes("0.80.x") && combined.includes("0.81.0")
  );
}

// 2. Wrong MAJOR (1.0) must also hard-fail.
{
  const r = run("1.0.0");
  assert("fake pi 1.0.0 exits non-zero", r.status !== 0, `exit=${r.status}`);
}

// 3. A matching MAJOR.MINOR (0.80) must NOT hard-fail on the version gate itself.
//    (It may still exit 2 INDETERMINATE if an offline surface probe can't run, but
//    it must not exit 1 for a version mismatch.) We assert it is not the
//    version-mismatch hard-fail by checking the remediation string is absent.
{
  const r = run("0.80.999");
  const combined = `${r.stdout || ""}${r.stderr || ""}`;
  assert(
    "fake pi 0.80.999 does NOT trigger the version-mismatch remediation",
    !combined.includes(REMEDIATION),
    `exit=${r.status}`
  );
}

console.log("compat-check unit test");
console.log(log.join("\n"));
console.log(`\n${log.length - failures}/${log.length} assertions passed`);

if (failures > 0) {
  console.error(`\nFAIL: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nOK: compat-check hard-fails on a pi MAJOR.MINOR mismatch.");
process.exit(0);
