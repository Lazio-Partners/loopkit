<!-- Filled by a later issue: the security hardening issue authors the full bodies. This is a scoped skeleton. -->

# Security

> ## ⚠️ pi runs with FULL user permissions and NO sandbox
>
> pi (and therefore loopkit) runs as **you**, with your full machine authority and **no sandbox**. A loop can run commands, edit files, push branches, and call out to the network exactly as your user account can. There is no containment layer. A scheduled `--approve` loop does all of this **unattended**. Treat every finding, detector output, and program-derived string as untrusted input to a shell.

## Denylist rationale

The denylist (`loop/guards/denylist.txt`) names command patterns the loop must refuse to run even under `--approve`. *(Rationale and the full pattern set are authored by the security hardening issue. The enforcing hook lands with the driver.)*

## `--approve` risks (pair with `PI_OFFLINE` + `PI_SKIP_VERSION_CHECK`, never bare)

Running pi with `--approve` removes the per-action human gate. loopkit's offline probes and any unattended invocation set `PI_OFFLINE=1` and `PI_SKIP_VERSION_CHECK=1` so pi's self-update nag never blocks the loop — but loopkit's **own** gates (denylist, caps, circuit breaker, kill-switch) are never skipped. **Never run a bare `--approve`** against anything you would not run unattended. *(Full guidance authored later.)*

## Kill-switch

The loop honors a **presence-of-file** hard halt: if `loop/guards/STOP` exists, every turn aborts at the top of the driver. The scaffold deliberately does **not** ship a `STOP` file (that would halt the loop by definition); see [`loop/guards/README.md`](../loop/guards/README.md). The enforcing check lands with the driver. *(Full kill-switch operations authored later.)*
