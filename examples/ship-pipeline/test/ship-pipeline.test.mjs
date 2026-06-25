import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../../..", import.meta.url).pathname;
const EXAMPLE = join(ROOT, "examples/ship-pipeline");

function tempExample() {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-ship-pipeline-"));
  cpSync(EXAMPLE, dir, { recursive: true });
  return dir;
}

test("ship-pipeline dry run composes tracker, worktree, reviewer verdict, and human checkpoint", () => {
  const dir = tempExample();
  const res = spawnSync("bash", [join(ROOT, "examples/ship-pipeline/run-pipeline.sh")], {
    cwd: ROOT,
    env: { ...process.env, LOOPKIT_EXAMPLE_ROOT: dir },
    encoding: "utf8"
  });
  assert.equal(res.status, 0, res.stderr);
  const round = JSON.parse(readFileSync(join(dir, "loop/state/artifacts/round-001.json"), "utf8"));
  assert.equal(round.finding_id, "LK-0001");
  assert.notEqual(round.worker.model, round.reviewer.model);
  assert.equal(round.verdict.next_action, "open_pr");
  assert.equal(round.verdict.human_checkpoint_required, true);
  assert.equal(existsSync(join(dir, ".worktrees/feat-lk-0001")), true);
  const sampleTest = spawnSync("npm", ["test"], { cwd: join(dir, ".worktrees/feat-lk-0001"), encoding: "utf8" });
  assert.equal(sampleTest.status, 0, sampleTest.stderr);
});
