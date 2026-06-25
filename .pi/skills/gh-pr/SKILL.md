---
name: gh-pr
description: Open and inspect pull requests with the gh CLI after reviewer approval. Use when persistence needs a human checkpoint PR. Read this SKILL.md.
---

# gh-pr

The driver may prepare a PR after an approve verdict:

```sh
gh pr create --base main --head feat/lk-NNNN --title "LK-NNNN: <title>" --body-file <body.md>
gh pr view --json url,state,headRefName,baseRefName
```

Binding rule: loopkit never auto-merges. A reviewer `approve` yields
`next_action: open_pr` with `human_checkpoint_required: true`. A human merges
after review. There is intentionally no helper script here so there is no merge
path hidden in automation.
