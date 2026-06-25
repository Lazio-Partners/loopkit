#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEXT_EXTS = new Set(["", ".md", ".mjs", ".js", ".ts", ".json", ".yaml", ".yml", ".sh", ".txt", ".plist", ".service", ".timer"]);

function allowed(path, allowPaths = []) {
  return allowPaths.some((prefix) => path === prefix || path.startsWith(prefix.replace(/\/$/, "") + "/"));
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

export function runLeakCheck(files, opts = {}) {
  const denylist = opts.denylist ?? JSON.parse(readFileSync(join(ROOT, "tools/leak-denylist.json"), "utf8"));
  const violations = [];
  const compiled = denylist.patterns.map((pattern) => ({
    ...pattern,
    re: new RegExp(pattern.regex, pattern.flags?.includes("g") ? pattern.flags : `${pattern.flags ?? ""}g`)
  }));

  for (const file of files) {
    for (const pattern of compiled) {
      if (allowed(file.path, pattern.allow_paths)) continue;
      pattern.re.lastIndex = 0;
      let match;
      while ((match = pattern.re.exec(file.source)) !== null) {
        violations.push({
          path: file.path,
          line: lineNumber(file.source, match.index),
          pattern: pattern.id,
          reason: pattern.reason,
          match: match[0]
        });
        if (match[0] === "") break;
      }
    }
  }
  return { violations };
}

function trackedFiles(root) {
  const res = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  if (res.status !== 0) throw new Error(res.stderr || "git ls-files failed");
  return res.stdout.split("\n").filter(Boolean);
}

function isText(path) {
  if (path.startsWith("node_modules/")) return false;
  if (path === "package-lock.json") return false;
  if (path.includes("/fixtures/")) return false;
  const ext = extname(path);
  return TEXT_EXTS.has(ext) || path.startsWith("loop/guards/");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = [];
  for (const path of trackedFiles(ROOT).filter(isText)) {
    try {
      files.push({ path, source: readFileSync(join(ROOT, path), "utf8") });
    } catch {
      // Ignore binary/symlink read failures; git-tracked text extensions are checked.
    }
  }
  const result = runLeakCheck(files);
  for (const v of result.violations) {
    console.error(`LEAK: ${v.path}:${v.line} matched [${v.pattern}] - ${v.reason}`);
  }
  if (result.violations.length) {
    console.error(`leak-check: ${result.violations.length} violation(s)`);
    process.exit(1);
  }
  console.log(`leak-check: clean (${files.length} files scanned)`);
}
