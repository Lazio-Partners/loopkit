# Scheduling loopkit

Every scheduler delegates to `loop/schedule/run-scheduled.sh`. The templates set
when the loop runs; the wrapper owns how pi is invoked safely.

## Placeholders

| Placeholder | Replace with |
| --- | --- |
| `__REPO_ROOT__` | Absolute path to this checkout. |
| `<your-model-id>` | The pi model id used for scheduled turns. |
| `/loop-discover` | The slash prompt to run on each trigger. |
| `0 * * * *` | Your GitHub Actions cadence. |

## macOS launchd

Copy `launchd.plist` to `~/Library/LaunchAgents/com.loopkit.loop.plist`, replace
`__REPO_ROOT__`, then run:

```sh
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.loopkit.loop.plist
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.loopkit.loop.plist
```

## Linux systemd

Copy `loopkit.service` and `systemd.timer` into `~/.config/systemd/user/`, replace
`__REPO_ROOT__`, then run:

```sh
systemctl --user enable --now systemd.timer
journalctl --user -u loopkit.service
```

## GitHub Actions

Copy `loop.yml` into `.github/workflows/loop.yml`, configure the required
secrets, and keep the human merge checkpoint. The workflow may open or update a
pull request through the driver path; it must not merge it.
