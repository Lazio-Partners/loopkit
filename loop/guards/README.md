# loop guards

loopkit has three independent halts. They are intentionally boring: each can be
checked without asking a model whether it should stop.

1. Daily cap: `loop/guards/caps.sh` reads `loop/state/heartbeat.json`.
2. Circuit breaker: `loop/guards/circuit-breaker.sh` reads consecutive failures.
3. Presence-of-file kill-switch: `loop/guards/STOP`.

This directory deliberately does **not** ship `STOP`. Creating that file is the
human emergency brake and the driver exits zero with `status: halted` so a
scheduler does not keep sending failure mail.

See `denylist.txt` for commands the driver/reviewer must refuse, and
`kill-switch` for the operations note.
