---
name: gh-issues
description: List GitHub issues via the gh CLI as loop findings. Use when discovery reads open work from a repo label. Read this SKILL.md, then run scripts/list-findings.sh.
---

# gh-issues

Use `scripts/list-findings.sh` to list open issues as TSV:

```text
number<TAB>title<TAB>url<TAB>labels
```

Inputs:

- `LOOPKIT_GH_LABEL`, default `loop`
- `LOOPKIT_GH_REPO`, optional owner/repo passed to `gh --repo`

The discovery prompt maps each row to an `LK-NNNN` finding with
`source: issue_tracker` and `source_ref` set to the issue URL. This skill reads
issues only; it does not write the registry.
