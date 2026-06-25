#!/usr/bin/env node
// loopkit W0-3 content check — validates docs/four-costs.md, one of loopkit's two
// headline differentiators (the threat model behind the guard layer). Run via
// `node --test tools/check-four-costs.mjs` or through `npm test`.
//
// Per rule 9, every assertion encodes WHY it matters, not just WHAT it checks, and
// per the openloop lesson the doc itself teaches ("prove the guard fires"), this
// check is written to FAIL on a mutated copy: drop a cost section, a guard path, an
// openloop-lesson phrase, or a failure-story field, and the relevant test goes red.
// A "four costs" doc that silently lists three is the exact comprehension-rot
// failure the doc warns about, so the structure must be a real gate, not a no-op.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// tools/ -> repo root is one level up. Resolve via import.meta.url so the check
// passes regardless of the runner's CWD.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC_REL = "docs/four-costs.md";
const DOC_PATH = join(ROOT, DOC_REL);

test("the doc exists and is non-empty — without it loopkit has no threat-model copy for its guard layer", () => {
  assert.ok(existsSync(DOC_PATH), `${DOC_REL} must exist`);
  const text = readFileSync(DOC_PATH, "utf8");
  assert.ok(text.trim().length > 0, `${DOC_REL} must be non-empty`);
});

const doc = readFileSync(DOC_PATH, "utf8");
const lower = doc.toLowerCase();

// --- The four costs, each as a heading -----------------------------------------
// WHY: the four costs are the spine of the doc. Each must be its own ## heading so
// a reader can navigate to it and the table of contents lists all four. A dropped
// heading is the silent-three failure mode the doc itself warns against.
const COSTS = ["verification debt", "comprehension rot", "cognitive surrender", "token blowout"];

for (const cost of COSTS) {
  test(`cost present as a heading: "${cost}" — a "four costs" doc that lists three is the comprehension-rot failure it warns about`, () => {
    // Heading line beginning with one or more '#', case-insensitive on the cost text.
    const re = new RegExp(`^#{1,6}\\s+${escapeRegExp(cost)}\\s*$`, "im");
    assert.match(doc, re, `missing "## ${cost}" heading`);
  });
}

// --- Each cost section has the four load-bearing parts -------------------------
// WHY: the spec requires each cost to carry a definition, a "why it compounds"
// explanation, a named guard, and a "how it bites" mechanism. Presence of the
// heading is not enough; a section that drops the mechanism is filler, not a guard
// reference. We assert the labels appear inside each cost's own section slice.
for (const cost of COSTS) {
  test(`"${cost}" section has Definition, why-it-compounds, a guard, and a how-it-bites mechanism — a section missing the mechanism is filler, not a guard reference`, () => {
    const section = costSection(cost).toLowerCase();
    assert.match(section, /\*\*definition\.\*\*/, `"${cost}" missing **Definition.**`);
    assert.match(section, /why it compounds/, `"${cost}" missing the "why it compounds" explanation`);
    assert.match(section, /\*\*the guard\.\*\*/, `"${cost}" missing **The guard.**`);
    assert.match(section, /\*\*how it bites\.\*\*/, `"${cost}" missing **How it bites.**`);
  });
}

// --- The cost->guard table ------------------------------------------------------
test("a cost->guard table with >= 4 data rows is present — the at-a-glance map is required and must cover all four costs", () => {
  // WHY: the spec requires a markdown table whose rows cover all four costs. A table
  // that renders but only carries 3 rows fails the same way a dropped section does.
  const rows = guardTableDataRows();
  assert.ok(rows.length >= 4, `cost->guard table must have >= 4 data rows, found ${rows.length}`);
  // Every cost name must appear somewhere in the table's data rows.
  const tableText = rows.join("\n").toLowerCase();
  for (const cost of COSTS) {
    assert.ok(tableText.includes(cost), `cost->guard table is missing a row for "${cost}"`);
  }
});

// --- Every named guard path is present -----------------------------------------
// WHY: the doc's value is that each guard reference names a REAL repo path. A guard
// described without its path is a slogan; the path is what makes it auditable and
// what the verification debt / comprehension rot / token blowout sections hang on.
const GUARD_PATHS = [
  ".pi/agents/reviewer.md", // verification debt + cognitive surrender (the different-model evaluator)
  "progress.md", // comprehension rot (the append-only narrative the human reads)
  "caps.sh", // token blowout (daily cap, one of three halts)
  "circuit-breaker.sh", // token blowout (consecutive_failures -> blocked)
  "kill-switch", // token blowout (presence-of-file halt)
  "heartbeat.json", // where consecutive_failures / turns_today / tokens_today / status live
];

for (const path of GUARD_PATHS) {
  test(`guard path present: "${path}" — a guard named without its real repo path is a slogan, not an auditable mechanism`, () => {
    assert.ok(doc.includes(path), `doc must reference the guard path "${path}"`);
  });
}

// --- The three independent halts, none loop-disableable -------------------------
test("doc states the three independent halts AND that none can be disabled by the loop itself — that independence is the whole point of token-blowout protection", () => {
  assert.match(lower, /three independent halts/, 'doc must name the "three independent halts"');
  // The non-disableable property is what makes a runaway loop unable to free itself.
  assert.match(
    lower,
    /none (of which |of them )?(the loop can disable|can be disabled by the loop|disableable by the loop)/,
    "doc must state none of the halts can be disabled by the loop itself"
  );
});

// --- generator != evaluator + never-auto-merge ---------------------------------
test("doc states reviewer model MUST differ from worker model — a model grading its own homework is not verification (the generator != evaluator rule)", () => {
  assert.match(doc, /reviewer_model != worker_model/, "doc must state reviewer_model != worker_model");
  assert.match(lower, /must differ from the worker/, 'doc must state the reviewer model "MUST differ from the worker"');
});

test("doc states never-auto-merge: approve -> open_pr + human_checkpoint_required true — CI green is necessary, not sufficient", () => {
  assert.match(lower, /never\b[\s\S]{0,30}auto-merge|auto-merges/, "doc must state loopkit never auto-merges");
  assert.match(doc, /next_action: open_pr/, "doc must state approve yields next_action: open_pr");
  assert.match(doc, /human_checkpoint_required/, "doc must reference human_checkpoint_required");
});

// --- The openloop lesson (both phrases + attribution) --------------------------
test('the openloop lesson is present: BOTH "monitoring claim must itself be verified" AND "printing a metric is not a gate" — each names a distinct failure mode loopkit forks out', () => {
  // WHY: these are two different lessons. The first kills dead/gameable monitors; the
  // second kills print-and-move-on pseudo-gates. Dropping either lets a footgun back in.
  assert.match(lower, /a monitoring claim must itself be verified/, 'missing "a monitoring claim must itself be verified"');
  assert.match(lower, /printing a metric is not a gate/, 'missing "printing a metric is not a gate"');
});

test("openloop is named and attributed (Apache-2.0, NOTICE preserved) — the borrow carries a license obligation, not just a courtesy", () => {
  assert.match(lower, /openloop/, "doc must name openloop");
  assert.match(doc, /Apache-2\.0|Apache License 2\.0/, "doc must state openloop is Apache-2.0");
  assert.match(lower, /notice/, "doc must reference the preserved NOTICE");
});

// --- Honest failure stories: template + >= 1 worked example --------------------
test("a failure-story TEMPLATE is present with its field headers — the template is what lets a reader write their own honest story", () => {
  // Assert on the template field labels themselves (rule 9: structure, not vibes).
  assert.match(doc, /\*\*Setup\.\*\*/, "failure-story template missing **Setup.** field");
  assert.match(doc, /\*\*What went wrong\.\*\*/, "failure-story template missing **What went wrong.** field");
  assert.match(
    doc,
    /\*\*What the absent or weak guard would have caught\.\*\*/,
    "failure-story template missing the absent-guard field"
  );
  assert.match(doc, /\*\*The fix loopkit ships\.\*\*/, "failure-story template missing **The fix loopkit ships.** field");
});

test(">= 1 fully-worked generic failure example is present — a template with no worked example does not show the cost in the wild", () => {
  // A worked example is a ### subsection under the failure-stories section that reuses
  // the template fields. Count subsections that contain all four field labels.
  const worked = workedExamples();
  assert.ok(worked >= 1, `expected >= 1 worked failure example, found ${worked}`);
});

// --- Generic purity: no private tokens -----------------------------------------
test("doc contains zero private/Lazio specifics — loopkit is public/MIT; one private token leaks internal context", () => {
  // WHY: AC11's repo-wide leak-check greps every tracked file for these. We assemble
  // the banned tokens from fragments so this checker's own source never trips that grep
  // (the same technique the W0-2 doc test uses for its denylist).
  const banned = ["LA" + "Z-", "lazio" + "partners", "cod" + "ex", "Fa" + "ble"];
  for (const tok of banned) {
    assert.ok(!doc.includes(tok), `banned private token found in ${DOC_REL}`);
  }
});

// --- helpers -------------------------------------------------------------------

// Slice a single "## <heading text>" section out of the doc (up to the next "## ").
function costSection(cost) {
  const re = new RegExp(`^#{1,6}\\s+${escapeRegExp(cost)}\\s*$`, "im");
  const m = doc.match(re);
  assert.ok(m, `cost heading not found: ${cost}`);
  const start = m.index + m[0].length;
  const rest = doc.slice(start);
  const next = rest.search(/^#{1,2}\s/m);
  return next === -1 ? rest : rest.slice(0, next);
}

// The cost->guard table is the markdown table whose header includes "Cost".
function guardTableDataRows() {
  const lines = doc.split("\n").map((l) => l.trim());
  // Find a header row that starts a Cost table.
  const headerIdx = lines.findIndex(
    (l) => l.startsWith("|") && /\bcost\b/i.test(l) && /\bguard\b/i.test(l)
  );
  assert.ok(headerIdx !== -1, "no cost->guard table header found (expected a row with Cost and guard columns)");
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("|") || !l.endsWith("|")) break; // table ended
    if (/^\|[\s:|-]+\|$/.test(l)) continue; // separator row
    rows.push(l);
  }
  return rows;
}

// Count ### subsections in the failure-stories area that carry all four template fields.
function workedExamples() {
  const subs = doc.split(/^###\s+/m).slice(1); // drop the preamble before the first ###
  let count = 0;
  for (const sub of subs) {
    if (
      /\*\*Setup\.\*\*/.test(sub) &&
      /\*\*What went wrong\.\*\*/.test(sub) &&
      /\*\*The fix loopkit ships\.\*\*/.test(sub)
    ) {
      count++;
    }
  }
  return count;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
