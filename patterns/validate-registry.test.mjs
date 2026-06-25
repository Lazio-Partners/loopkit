import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validateRegistryText } from "./validate-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("registry validator accepts the committed seed findings because discovery needs a real starting shape", () => {
  const result = validateRegistryText(readFileSync(join(ROOT, "patterns/registry.yaml"), "utf8"));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.count, 2);
});

test("registry validator rejects vendor-directory detectors because files-exist is not work evidence", () => {
  const bad = `
schema_version: 1
findings:
  - id: LK-0099
    title: Bad detector
    source: manual
    source_ref: local
    status: open
    priority: p1
    isolation: { branch: feat/lk-0099, worktree: .worktrees/feat-lk-0099 }
    acceptance: prove it
    detector: test -d .claude/skills
    created_at: 2026-06-25T00:00:00Z
    updated_at: 2026-06-25T00:00:00Z
`;
  const result = validateRegistryText(bad);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /agent-vendor directory grep/);
});

test("registry CLI fails loud on invalid input so CI cannot silently pass a bad registry", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-registry-"));
  const file = join(dir, "bad.yaml");
  writeFileSync(file, "schema_version: 1\nfindings:\n  - id: BAD\n");
  assert.throws(
    () => execFileSync(process.execPath, [join(ROOT, "patterns/validate-registry.mjs"), "--file", file], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
    /Command failed/
  );
});
