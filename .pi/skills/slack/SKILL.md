---
name: slack
description: Post loop checkpoint notifications to Slack through a webhook. Use when a turn needs human attention. Read this SKILL.md, then run scripts/notify.sh.
---

# slack

Default path: send a webhook message.

Required env:

- `SLACK_WEBHOOK_URL`
- `SLACK_MESSAGE`, or pass the message as argv

```sh
SLACK_WEBHOOK_URL=... scripts/notify.sh "Round 007 needs a human checkpoint"
```

Teams that prefer bot tokens can use Slack `chat.postMessage` with
`SLACK_BOT_TOKEN`, but the webhook path is the default because it is easier to
audit and needs no extra SDK.
