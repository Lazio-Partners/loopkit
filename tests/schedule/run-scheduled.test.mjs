import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";

const ROOT = new URL("../..", import.meta.url).pathname;
const SCRIPT = join(ROOT, "loop/schedule/run-scheduled.sh");
const STOP = join(ROOT, "loop/guards/STOP");

function makeStubPi(dir, exitCode = 0) {
  const bin = join(dir, "pi");
  writeFileSync(bin, `#!/usr/bin/env bash
set -euo pipefail
echo "argv:$*" >> "$RECORDER"
echo "env:$PI_OFFLINE:$PI_SKIP_VERSION_CHECK" >> "$RECORDER"
exit ${exitCode}
`);
  chmodSync(bin, 0o755);
  return bin;
}

function runWrapper(env) {
  return spawnSync("bash", [SCRIPT], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

test("missing LOOPKIT_MODEL fails loud so a scheduled loop never guesses the model", () => {
  const res = runWrapper({ LOOPKIT_MODEL: "" });
  assert.equal(res.status, 64);
  assert.match(res.stderr, /LOOPKIT_MODEL/);
});

test("invalid iteration cap fails loud because recurrence needs a hard outer bound", () => {
  const res = runWrapper({ LOOPKIT_MODEL: "model", LOOPKIT_MAX_ITERATIONS: "0" });
  assert.equal(res.status, 64);
  assert.match(res.stderr, /positive integer/);
});

test("stub pi sees named slash command, approve flag, model, resume flag, and clean env", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-schedule-"));
  const recorder = join(dir, "recorder.txt");
  makeStubPi(dir);
  const res = runWrapper({
    PATH: `${dir}:${process.env.PATH}`,
    RECORDER: recorder,
    LOOPKIT_MODEL: "model-a",
    LOOPKIT_MAX_ITERATIONS: "2"
  });
  assert.equal(res.status, 0, res.stderr);
  const text = readFileSync(recorder, "utf8");
  assert.equal((text.match(/argv:/g) ?? []).length, 2);
  assert.match(text, /-p \/loop-discover --approve --model model-a -c/);
  assert.match(text, /env:1:1/);
});

test("fresh first iteration omits resume but later iterations resume the same thread", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-schedule-"));
  const recorder = join(dir, "recorder.txt");
  makeStubPi(dir);
  const res = runWrapper({
    PATH: `${dir}:${process.env.PATH}`,
    RECORDER: recorder,
    LOOPKIT_MODEL: "model-a",
    LOOPKIT_FRESH: "1",
    LOOPKIT_MAX_ITERATIONS: "2"
  });
  assert.equal(res.status, 0, res.stderr);
  const lines = readFileSync(recorder, "utf8").split("\n").filter((line) => line.startsWith("argv:"));
  assert.ok(!lines[0].includes(" -c"), lines[0]);
  assert.ok(lines[1].includes(" -c"), lines[1]);
});

test("kill-switch exits zero and invokes no pi so humans can halt without scheduler spam", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-schedule-"));
  const recorder = join(dir, "recorder.txt");
  makeStubPi(dir);
  writeFileSync(STOP, "stop\n");
  try {
    const res = runWrapper({
      PATH: `${dir}:${process.env.PATH}`,
      RECORDER: recorder,
      LOOPKIT_MODEL: "model-a"
    });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /halted/);
    assert.equal(existsSync(recorder), false);
  } finally {
    rmSync(STOP, { force: true });
  }
});

test("pi non-zero propagates and stops the iteration loop", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-schedule-"));
  const recorder = join(dir, "recorder.txt");
  makeStubPi(dir, 7);
  const res = runWrapper({
    PATH: `${dir}:${process.env.PATH}`,
    RECORDER: recorder,
    LOOPKIT_MODEL: "model-a",
    LOOPKIT_MAX_ITERATIONS: "2"
  });
  assert.equal(res.status, 7);
  const text = readFileSync(recorder, "utf8");
  assert.equal((text.match(/argv:/g) ?? []).length, 1);
});
