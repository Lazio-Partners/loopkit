# Connectors

pi does not ship built-in service connectors. loopkit keeps connectors
CLI-first: each service is a skill that documents one hardened command path.

| Connector | Binary | Required env | Output |
| --- | --- | --- | --- |
| `gh-issues` | `gh` | optional `LOOPKIT_GH_LABEL`, `LOOPKIT_GH_REPO` | TSV issue rows |
| `gh-pr` | `gh` | none in the skill body | PR URL/state through `gh pr view` |
| `linear-graphql` | `curl`, `jq` | `LINEAR_API_KEY` | GraphQL JSON |
| `slack` | `curl`, `jq` | `SLACK_WEBHOOK_URL` | webhook post |

The scripts fail loud when a binary or token is missing. Silent empty output is
not allowed because discovery could mistake it for "no work".

## Optional MCP alternative

Teams that already run MCP servers can replace these CLI commands with local
MCP-client wrappers, but that is an extension point rather than the default. The
public kit stays portable by depending on shell commands with explicit env vars.
