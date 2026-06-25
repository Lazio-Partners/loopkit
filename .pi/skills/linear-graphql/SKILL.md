---
name: linear-graphql
description: Query Linear through curl and GraphQL for tracker-backed discovery. Use when teams store findings in Linear. Read this SKILL.md, then run scripts/linear-query.sh.
---

# linear-graphql

Linear has no required CLI dependency here, so loopkit wraps GraphQL with `curl`.

Required env:

- `LINEAR_API_KEY`
- Optional `LINEAR_TEAM_KEY` used by `references/issues-by-team.graphql`

Run:

```sh
LINEAR_API_KEY=... LINEAR_TEAM_KEY=ABC scripts/linear-query.sh references/issues-by-team.graphql '{"teamKey":"ABC"}'
```

The script sends personal API keys in the raw `Authorization` header, which is
Linear's personal API-key convention. It surfaces GraphQL errors as failures.
