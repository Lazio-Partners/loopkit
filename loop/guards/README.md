<!-- Filled by a later issue: the guards issue authors enforcement. STUB: documents the kill-switch; the enforcing checks land with the driver. -->

# loopkit guards

The guards enforce the limits behind the **four costs**. Three independent halts can stop the loop: the **daily turn cap** (`caps.sh`), the **circuit breaker** (`circuit-breaker.sh`, a consecutive-failure ceiling), and the **kill-switch** (below). The command **denylist** (`denylist.txt`) refuses dangerous commands even under `--approve`.

## Kill-switch (presence-of-file)

The loop honors a hard halt by the **presence of a file**: if `loop/guards/STOP` exists, **every turn aborts at the top of the driver** before any work runs. To stop a running loop, create that file:

```sh
touch loop/guards/STOP
```

To resume, remove it (`rm loop/guards/STOP`).

> **This scaffold deliberately does NOT ship a `STOP` file** — shipping one would halt the loop by definition. The enforcing check (the line in `loop/loop-driver.sh` that aborts when `loop/guards/STOP` exists) lands with the driver in a later issue. This README documents the contract so the driver author and operators agree on it.
