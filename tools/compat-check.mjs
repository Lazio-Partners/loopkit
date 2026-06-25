#!/usr/bin/env node
// loopkit pi compatibility gate (W0-0).
//
// pi's own AGENTS.md declares MINOR bumps are BREAKING and there are no major
// releases, so a 0.80 -> 0.81 bump can break the surfaces loopkit depends on.
// SemVer caret ranges are therefore unsafe. This gate:
//
//   1. Asserts the installed pi's MAJOR.MINOR equals the pinned MAJOR.MINOR (0.80).
//      On mismatch it HARD FAILS (exit non-zero) with the documented remediation.
//   2. Probes the four load-bearing pi surfaces loopkit actually depends on, each a
//      tiny STRUCTURAL smoke test that runs with no network and no API key
//      (PI_OFFLINE=1 PI_SKIP_VERSION_CHECK=1): (a) `pi --mode json` single-shot;
//      (b) the subagent flag surface (--model + --tools allowlist); (c) skill
//      discovery reads .pi/skills (--skill); (d) the tool_call hook can block.
//   A probe that genuinely cannot run offline SKIPS WITH A LOUD WARNING and makes
//   the overall result INDETERMINATE (non-zero) — it never silently passes.
//
// loopkit's OWN gate is never skipped. The PI_SKIP_VERSION_CHECK env only silences
// pi's self-update nag during the probes.
//
// Test seam: set LOOPKIT_FAKE_PI_VERSION to force the "installed" version (used by
// the compat-check unit test to assert the mismatch hard-fail path).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// The exact pi version this kit was proven against is recorded here and in docs/contracts.md.
const PINNED_RANGE = "0.80.x";
const PINNED_MAJOR_MINOR = "0.80";
const PI_PACKAGE_NAMES = ["@earendil-works/pi-coding-agent", "pi-coding-agent"];

const probeEnv = { ...process.env, PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1" };

function readPinFromPackageJson() {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  // pi is the harness (installed separately, e.g. via brew), NOT a runtime npm
  // dependency — loopkit takes no runtime dependency on pi (see NOTICE). The
  // published npm package is scoped; the unscoped key is kept only as a legacy
  // fallback for older scaffolds.
  for (const name of PI_PACKAGE_NAMES) {
    const pin =
      pkg?.optionalDependencies?.[name] ??
      pkg?.dependencies?.[name] ??
      pkg?.devDependencies?.[name];
    if (pin) return { name, pin };
  }
  return { name: PI_PACKAGE_NAMES[0], pin: undefined };
}

function getInstalledPiVersion() {
  if (process.env.LOOPKIT_FAKE_PI_VERSION) {
    return process.env.LOOPKIT_FAKE_PI_VERSION.trim();
  }
  const out = execFileSync("pi", ["--version"], {
    encoding: "utf8",
    env: probeEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const m = out.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`could not parse pi version from: ${out.trim()}`);
  return m[0];
}

function majorMinor(v) {
  const m = v.match(/^(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}` : null;
}

// Capture pi --help once; the offline structural probes inspect its flag surface
// rather than making a model call (no network, no API key required).
function piHelp() {
  return execFileSync("pi", ["--help"], {
    encoding: "utf8",
    env: probeEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

const lines = [];
let hardFail = false;
let indeterminate = false;

function log(s) {
  lines.push(s);
}

// --- 1. version gate (loopkit's own gate — never skipped) ---
const { name: pinName, pin } = readPinFromPackageJson();
log(`pinned (package.json):  ${pinName} ${pin ?? "<missing>"}`);
log(`pinned range (gate):    ${PINNED_RANGE}`);

if (pin !== PINNED_RANGE) {
  hardFail = true;
  log(`MISMATCH: package.json pins "${pin}", gate expects "${PINNED_RANGE}".`);
}

let installed;
try {
  installed = getInstalledPiVersion();
} catch (err) {
  log(`installed pi:           <could not detect: ${err.message}>`);
  console.error(lines.join("\n"));
  console.error(
    `\nloopkit is pinned to pi ${PINNED_RANGE}; pi could not be detected. ` +
      `Pin or update loopkit, do not run untested.`
  );
  process.exit(1);
}

log(`installed pi:           ${installed}`);
const installedMM = majorMinor(installed);
log(`installed MAJOR.MINOR:  ${installedMM}`);

if (installedMM !== PINNED_MAJOR_MINOR) {
  hardFail = true;
  log(
    `\nloopkit is pinned to pi ${PINNED_RANGE}; you have ${installed}. ` +
      `Pin or update loopkit, do not run untested.`
  );
}

// --- 2. four load-bearing surface probes (structural, offline) ---
// Only meaningful when we can actually read pi's help surface offline.
if (!hardFail || process.env.LOOPKIT_FORCE_PROBES === "1") {
  let help = "";
  try {
    help = piHelp();
  } catch (err) {
    indeterminate = true;
    log(`\nPROBE INDETERMINATE: could not read pi --help offline: ${err.message}`);
  }

  if (help) {
    const probe = (name, present, detail) => {
      if (present) {
        log(`  probe OK    ${name}`);
      } else {
        indeterminate = true;
        log(`  probe SKIP  ${name} — ${detail} (INDETERMINATE, not a silent pass)`);
      }
    };
    // (a) `pi --mode json` single-shot result surface.
    probe("a) --mode json single-shot", /--mode\s+<mode>/.test(help) && /json/.test(help),
      "no --mode json flag in pi --help");
    // (b) subagent contract: own model + tool allowlist flags.
    probe("b) subagent flags (--model + --tools allowlist)",
      /--model\b/.test(help) && /(--tools\b|-t\s)/.test(help),
      "no --model/--tools flags in pi --help");
    // (c) skill discovery reads .pi/skills (--skill load path).
    probe("c) skill discovery (--skill / .pi/skills)",
      /--skill\b/.test(help) && /--no-skills\b/.test(help),
      "no --skill flag in pi --help");
    // (d) tool_call hook can block — extension/hook surface present.
    probe("d) tool_call hook (extension surface)",
      /--extension\b/.test(help) || /-e\s+<path>/.test(help),
      "no --extension flag in pi --help");
  }
} else {
  log(
    `\n(surface probes skipped: version gate already HARD-FAILED; ` +
      `set LOOPKIT_FORCE_PROBES=1 to run them anyway against the wrong pi.)`
  );
}

// --- report + exit ---
console.log(`loopkit pi compat-check (proven against pi ${PINNED_RANGE})`);
console.log(lines.join("\n"));

if (hardFail) {
  process.exit(1);
}
if (indeterminate) {
  console.error(
    "\nINDETERMINATE: one or more surface probes could not run offline. " +
      "Fail loud — do not treat as a pass."
  );
  process.exit(2);
}
console.log("\nOK: pi version + four load-bearing surfaces match the loopkit pin.");
process.exit(0);
