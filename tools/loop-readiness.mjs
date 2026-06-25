#!/usr/bin/env node
// loopkit-readiness — the L0–L3 readiness audit (STUB).
//
// W0-1 ships this as a runnable placeholder so the `loopkit-readiness` bin works and
// `npm install`/`npm link` succeed. The real L0–L3 audit (scaffold → deps → pi compat →
// proven loop) is implemented by the readiness-audit issue. It must exit 0 here so the
// scaffold's bin is demonstrably runnable; a later issue gives it real pass/fail logic.
console.log(
  "loopkit readiness -- L0: scaffold present. Full L0-L3 audit not yet implemented (tracked separately)."
);
process.exit(0);
