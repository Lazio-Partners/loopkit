<!-- Filled by a later issue: the scheduling-recipe issue authors this doc in full. -->

# Scheduling

How to re-run the loop on a cadence (launchd, systemd timer, CI cron) — pi has no scheduler of its own, so scheduling is external automation wrapping `loop/loop-driver.sh`.

**This doc is a placeholder.** The full scheduling recipes (and the templates in `loop/schedule/`) are authored by the scheduling-recipe issue. Until then, see [`docs/architecture.md`](architecture.md) §5 (Scheduling) and [`docs/security.md`](security.md) for why a scheduled `--approve` loop must never run bare.
