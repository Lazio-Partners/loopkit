import { test } from "node:test";
import assert from "node:assert/strict";
import { runLeakCheck } from "./leak-check.mjs";

function check(path, source) {
  return runLeakCheck([{ path, source }]).violations;
}

test("private tracker keys fail everywhere because public findings use LK-NNNN", () => {
  assert.equal(check("docs/example.md", "See LAZ-123 for details").length, 1);
});

test("private domains and infrastructure names fail even in docs", () => {
  const violations = check("docs/example.md", "visit laziopartners.com on ovhcloud-server");
  assert.equal(violations.length, 2);
});

test("tailnet IPs fail because public examples must not reveal private network ranges", () => {
  assert.equal(check("README.md", "debug at 100.64.1.2").length, 1);
});

test("Claude path and Skill-tool assumptions fail in code paths but pass in the translation doc", () => {
  assert.equal(check("loop/run.sh", "read .claude/skills and use the Skill tool").length, 2);
  assert.equal(check("docs/primitive-translation.md", "read .claude/skills and use the Skill tool").length, 0);
});

test("word boundaries avoid obvious false positives", () => {
  assert.equal(check("README.md", "thermos decode").length, 0);
});

test("internal app names are still caught as words", () => {
  assert.equal(check("docs/example.md", "Fable reviewed it").length, 1);
});
