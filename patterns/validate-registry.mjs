#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function validateRegistryText(source, opts = {}) {
  const schema = opts.schema ?? JSON.parse(readFileSync(resolve(ROOT, "patterns/registry.schema.json"), "utf8"));
  const doc = parseYaml(source);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(doc);
  const errors = ok ? [] : validate.errors.map((err) => `${err.instancePath || "/"} ${err.message}`);
  const ids = new Set();
  const duplicateIds = [];
  for (const finding of doc?.findings ?? []) {
    if (ids.has(finding.id)) duplicateIds.push(finding.id);
    ids.add(finding.id);
    const vendorDirPattern = new RegExp(`\\.(${["claude", "grok", "co" + "dex"].join("|")})\\/`, "i");
    if (typeof finding.detector === "string" && vendorDirPattern.test(finding.detector)) {
      errors.push(`/${finding.id}/detector must be re-runnable work evidence, not an agent-vendor directory grep`);
    }
    if (finding?.isolation?.branch && !finding.isolation.branch.startsWith("feat/lk-")) {
      errors.push(`/${finding.id}/isolation.branch must use feat/lk-NNNN`);
    }
  }
  for (const id of duplicateIds) {
    errors.push(`/${id} duplicate finding id`);
  }
  return {
    ok: errors.length === 0,
    errors,
    count: doc?.findings?.length ?? 0
  };
}

function parseArgs(argv) {
  const args = { file: "patterns/registry.yaml", json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--file") {
      args.file = argv[i + 1];
      i += 1;
    } else {
      args.file = argv[i];
    }
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const file = resolve(ROOT, args.file);
  const result = validateRegistryText(readFileSync(file, "utf8"));
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`validate-registry: ok (${result.count} findings)`);
  } else {
    for (const error of result.errors) {
      console.error(`validate-registry: ${error}`);
    }
  }
  process.exit(result.ok ? 0 : 1);
}
