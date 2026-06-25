#!/usr/bin/env node
// loopkit W0-2 test — validates docs/primitive-translation.md, the Claude Code → pi
// primitive map. Run via `node --test tests/docs/primitive-translation.test.mjs`.
//
// Each test encodes WHY the assertion matters, not just WHAT it checks (rule 9):
// the doc is the single highest-value public artifact in the repo, so a structural
// regression — a dropped heading, an unclassified row, the banned Skill-tool
// phrasing, or a dead intra-repo link — must fail loudly (rule 12), not slide by.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// tests/docs/ -> repo root is two levels up. Resolve via import.meta.url so the
// test passes no matter what CWD the runner uses.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOC_REL = "docs/primitive-translation.md";
const DOC_PATH = join(ROOT, DOC_REL);

const VALID_CLASSIFICATIONS = new Set(["native", "via-example", "toolkit-supplied"]);

test("the doc exists — without it loopkit has no translation map, its #1 public artifact", () => {
  assert.ok(existsSync(DOC_PATH), `${DOC_REL} must exist`);
});

const doc = readFileSync(DOC_PATH, "utf8");

// --- Structure: required headings (rule 12, one assertion per heading so a failure
// names exactly which section a reader would be missing) -------------------------
const REQUIRED_HEADINGS = [
  "# Primitive translation: Claude Code → pi",
  "## Why this map",
  "## The map",
  "## The three hard gaps",
  "## There is no Skill tool",
  "## MCP",
  "## Proven against pi",
];

for (const heading of REQUIRED_HEADINGS) {
  test(`required heading present: "${heading}" — a reader navigates the map by these sections`, () => {
    // Match the heading as a whole line, so "## MCP" does not falsely match inside prose.
    const re = new RegExp(`^${escapeRegExp(heading)}\\s*$`, "m");
    assert.match(doc, re, `missing required heading: ${heading}`);
  });
}

test("the three hard-gap ### subsections each name their gap — the gaps are the load-bearing absences", () => {
  // WHY: the three gaps (no scheduler, no worktree, no /goal) are the rows loopkit had
  // to BUILD. A reader must see each called out as its own subsection naming the file.
  for (const sub of ["### No scheduler", "### No `git worktree`", "### No `/goal`"]) {
    const re = new RegExp(`^${escapeRegExp(sub)}`, "m");
    assert.match(doc, re, `missing hard-gap subsection: ${sub}`);
  }
  // Each gap names the loopkit file that fills it (as prose paths, not links).
  assert.match(doc, /loop\/schedule\//, "no-scheduler subsection must name loop/schedule/*");
  assert.match(doc, /loop\/worktree\.sh/, "no-worktree subsection must name loop/worktree.sh");
  assert.match(doc, /loop\/loop-driver\.sh/, "no-/goal subsection must name loop/loop-driver.sh");
  assert.match(doc, /\.pi\/agents\/reviewer\.md/, "no-/goal subsection must name .pi/agents/reviewer.md");
});

// --- The map table: header shape, row count, classification enum ----------------
function mapTableRows() {
  // Slice the "## The map" section (up to the next "## ") and pull the table rows.
  const start = doc.indexOf("## The map");
  assert.ok(start !== -1, '"## The map" section not found');
  const rest = doc.slice(start + "## The map".length);
  const end = rest.search(/\n## /);
  const section = end === -1 ? rest : rest.slice(0, end);
  // Pipe-table lines only.
  const lines = section.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|") && l.endsWith("|"));
  return lines;
}

test("the map has the EXACT 4-column header — readers and tooling rely on column order/names", () => {
  const lines = mapTableRows();
  assert.ok(lines.length >= 2, "map table must have a header + separator at minimum");
  const header = cells(lines[0]);
  assert.deepEqual(
    header,
    ["Claude Code primitive", "pi surface", "Classification", "Notes"],
    "map header must be exactly: Claude Code primitive | pi surface | Classification | Notes"
  );
});

test("the map has ≥ 13 data rows — one per Claude Code primitive; a dropped row means a missing translation", () => {
  const dataRows = dataTableRows();
  assert.ok(
    dataRows.length >= 13,
    `expected ≥ 13 data rows (one per primitive), found ${dataRows.length}`
  );
});

test("every data row is classified native | via-example | toolkit-supplied — an unclassified row leaves a reader unable to tell what loopkit had to supply", () => {
  const dataRows = dataTableRows();
  for (const row of dataRows) {
    const c = cells(row);
    const classification = c[2];
    assert.ok(
      VALID_CLASSIFICATIONS.has(classification),
      `invalid/empty Classification "${classification}" in row: ${row}`
    );
  }
});

// All non-header, non-separator pipe rows in the map table.
function dataTableRows() {
  const lines = mapTableRows();
  // Drop the header (index 0) and any separator line (only spaces, colons, dashes, pipes).
  return lines.filter((l, i) => i > 0 && !/^\|[\s:|-]+\|$/.test(l));
}

// --- The no-Skill-tool gotcha ---------------------------------------------------
test("doc states the no-Skill-tool gotcha (read the SKILL.md or /skill:<name>) — the single most load-bearing pi difference", () => {
  const lower = doc.toLowerCase();
  // The gotcha must establish BOTH that there is no Skill tool AND how you actually invoke a skill.
  assert.match(lower, /no\b[\s\S]{0,40}skill tool/, 'doc must state there is "no ... Skill tool"');
  assert.ok(
    lower.includes("read") && (doc.includes("/skill:") || lower.includes("skill.md")),
    "doc must say to read the SKILL.md or run /skill:<name>"
  );
});

test("doc contains NONE of the banned skill phrasings — these are the exact anti-patterns the conventions forbid", () => {
  // WHY (rule 9): the phrasing matters, not just the concept. "use the Skill tool" and
  // "call the skill" are the precise wrong mental models; banning the strings keeps the
  // doc from teaching a Claude Code habit that does not exist in pi.
  const lower = doc.toLowerCase();
  assert.ok(!lower.includes("use the skill tool"), 'banned phrasing "use the Skill tool" present');
  assert.ok(!lower.includes("call the skill"), 'banned phrasing "call the skill" present');
});

// --- The pin + compat-check cross-reference -------------------------------------
test("doc states the 0.80.x pin, that minor bumps are breaking, and names the compat-check", () => {
  assert.match(doc, /0\.80\.x/, "doc must state the 0.80.x pin");
  assert.match(
    doc,
    /minor bumps? (are|is) breaking|treats minor bumps as breaking/i,
    "doc must state minor bumps are breaking"
  );
  assert.match(doc, /compat-check/, "doc must reference the compat-check by name");
});

// --- No Lazio / private specifics ----------------------------------------------
test("doc contains zero Lazio/private specifics — loopkit is public/MIT; one private token leaks internal context", () => {
  // Tokens are assembled from fragments so the literal banned strings never appear in
  // THIS source file — that keeps the repo-wide leak-check (scaffold.test.mjs AC11),
  // which greps every tracked file, from flagging this test's own denylist.
  const banned = ["LA" + "Z-", "lazio" + "partners", "cod" + "ex", "Fa" + "ble"];
  for (const tok of banned) {
    assert.ok(!doc.includes(tok), `banned private token found in ${DOC_REL}`);
  }
});

// --- Intra-repo links resolve ---------------------------------------------------
test("every intra-repo markdown link resolves — backtick forward-refs, real links only to files that exist", () => {
  // Extract [text](target); skip external (http/https/mailto) and pure #anchor links.
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  const missing = [];
  for (const match of doc.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (/^(https?:|mailto:)/i.test(target)) continue;
    if (target.startsWith("#")) continue;
    target = target.split("#")[0]; // strip any #anchor on a file link
    if (target === "") continue;
    // Links in this doc are relative to docs/ (the doc's own directory).
    const abs = resolve(dirname(DOC_PATH), target);
    if (!existsSync(abs)) missing.push(target);
  }
  assert.deepEqual(missing, [], `intra-repo links point at missing files: ${missing.join(", ")}`);
});

function cells(row) {
  // "| a | b | c |" -> ["a","b","c"]
  return row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
