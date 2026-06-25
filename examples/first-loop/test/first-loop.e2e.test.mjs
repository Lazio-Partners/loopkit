import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../../..", import.meta.url).pathname;
const EXAMPLE = join(ROOT, "examples/first-loop");

function tempExample() {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-first-loop-"));
  cpSync(EXAMPLE, dir, { recursive: true });
  return dir;
}

test("first-loop mock run proves all five moves and never auto-merges", () => {
  const dir = tempExample();
  const res = spawnSync("bash", [join(ROOT, "examples/first-loop/run-first-loop.sh")], {
    cwd: ROOT,
    env: { ...process.env, LOOPKIT_EXAMPLE_ROOT: dir },
    encoding: "utf8"
  });
  assert.equal(res.status, 0, res.stderr);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.finding_id, "LK-0001");
  assert.equal(round.branch, "feat/lk-0001");
  assert.notEqual(round.worker.model, round.reviewer.model);
  assert.equal(round.verdict.next_action, "open_pr");
  assert.equal(round.verdict.human_checkpoint_required, true);
  assert.match(readFileSync(join(dir, "loop/state/progress.md"), "utf8"), /No PR merged/);
  assert.equal(existsSync(join(dir, ".worktrees/feat-lk-0001")), true);
  const sandboxTest = spawnSync("npm", ["test"], { cwd: join(dir, ".worktrees/feat-lk-0001"), encoding: "utf8" });
  assert.equal(sandboxTest.status, 0, sandboxTest.stderr);
});

test("first-loop kill-switch halts before any subagent-style work", () => {
  const dir = tempExample();
  mkdirSync(join(dir, "loop/guards"), { recursive: true });
  writeFileSync(join(dir, "loop/guards/STOP"), "stop\n");
  const res = spawnSync("bash", [join(ROOT, "examples/first-loop/run-first-loop.sh")], {
    cwd: ROOT,
    env: { ...process.env, LOOPKIT_EXAMPLE_ROOT: dir, LOOPKIT_GUARD_DIR: join(dir, "loop/guards") },
    encoding: "utf8"
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /halted/);
});
