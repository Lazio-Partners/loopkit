import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../..", import.meta.url).pathname;

function run(script, env = {}, args = []) {
  return spawnSync("/bin/bash", [join(ROOT, script), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

test("gh issue discovery fails loud when gh is missing so empty output is never mistaken for no findings", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-connector-"));
  const res = run(".pi/skills/gh-issues/scripts/list-findings.sh", { PATH: dir });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /gh is required/);
});

test("gh issue discovery emits stable TSV from the gh CLI output path", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-connector-"));
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "auth" ]]; then exit 0; fi
printf '42\\tFix empty input\\thttps://example.test/issues/42\\tloop,bug\\n'
`);
  chmodSync(join(dir, "gh"), 0o755);
  const res = run(".pi/skills/gh-issues/scripts/list-findings.sh", { PATH: `${dir}:${process.env.PATH}` });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, "42\tFix empty input\thttps://example.test/issues/42\tloop,bug\n");
});

test("Linear query fails loud without LINEAR_API_KEY so discovery cannot run unauthenticated", () => {
  const res = run(".pi/skills/linear-graphql/scripts/linear-query.sh", { LINEAR_API_KEY: "" }, [".pi/skills/linear-graphql/references/issues-by-team.graphql"]);
  assert.equal(res.status, 64);
  assert.match(res.stderr, /LINEAR_API_KEY/);
});

test("Linear query surfaces GraphQL errors instead of silently returning bad tracker data", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-connector-"));
  writeFileSync(join(dir, "curl"), `#!/usr/bin/env bash
printf '{"errors":[{"message":"bad query"}]}'
`);
  chmodSync(join(dir, "curl"), 0o755);
  const res = run(".pi/skills/linear-graphql/scripts/linear-query.sh", { PATH: `${dir}:${process.env.PATH}`, LINEAR_API_KEY: "key" }, [".pi/skills/linear-graphql/references/issues-by-team.graphql", "{}"]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /bad query/);
});

test("Slack notification sends shell metacharacters literally through JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-connector-"));
  const capture = join(dir, "body.txt");
  writeFileSync(join(dir, "curl"), `#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--data" ]]; then
    printf "%s" "$2" > "${capture}"
    exit 0
  fi
  shift
done
`);
  chmodSync(join(dir, "curl"), 0o755);
  const message = 'needs review $(whoami) `uname`';
  const res = run(".pi/skills/slack/scripts/notify.sh", { PATH: `${dir}:${process.env.PATH}`, SLACK_WEBHOOK_URL: "https://example.test/hook" }, [message]);
  assert.equal(res.status, 0, res.stderr);
  const body = JSON.parse(readFileSync(capture, "utf8"));
  assert.equal(body.text, message);
});

test("Slack notification fails loud on webhook HTTP errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "loopkit-connector-"));
  const argsPath = join(dir, "curl-args.txt");
  writeFileSync(join(dir, "curl"), `#!/usr/bin/env bash
set -euo pipefail
printf "%s\\n" "$*" > "${argsPath}"
exit 22
`);
  chmodSync(join(dir, "curl"), 0o755);
  const res = run(".pi/skills/slack/scripts/notify.sh", { PATH: `${dir}:${process.env.PATH}`, SLACK_WEBHOOK_URL: "https://example.test/hook" }, ["hello"]);
  assert.equal(res.status, 22);
  assert.doesNotMatch(res.stdout, /notification sent/);
  assert.match(readFileSync(argsPath, "utf8"), /--fail-with-body/);
});

test("connector docs never imply the nonexistent pi skill invocation path", () => {
  const paths = [
    ".pi/skills/gh-issues/SKILL.md",
    ".pi/skills/gh-pr/SKILL.md",
    ".pi/skills/linear-graphql/SKILL.md",
    ".pi/skills/slack/SKILL.md",
    "docs/connectors.md"
  ];
  const callSkill = ["call", "the", "skill"].join(" ");
  const skillTool = ["Skill", "tool"].join(" ");
  const useSkillTool = ["use", "the", "Skill", "tool"].join(" ");
  const forbidden = new RegExp(`${callSkill}|${skillTool}|${useSkillTool}`, "i");
  for (const path of paths) {
    const text = readFileSync(join(ROOT, path), "utf8");
    assert.doesNotMatch(text, forbidden, path);
  }
});
