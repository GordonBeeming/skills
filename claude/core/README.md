# core

Gordon's always-on workflow set: /work (plan, build, verify, PR with an autonomy dial), /review (PR and branch review with a depth dial), /skill-fix, the azure context skill, envlock, cross-agent runners for Codex and Antigravity, and the hooks that enforce them.

## Install

### Claude Code

```bash
claude plugin install core@gordon-skills
```

### Codex

```bash
git clone git@github.com:GordonBeeming/skills.git
cd skills
for s in claude/core/skills/*; do
  ln -s "$PWD/$s" ~/.codex/skills/"$(basename "$s")"
done
```

## Skills

- **pr** — Take the current worktree's changes to a pull request and, if asked, through to merge: commit,
- **azure** — Set the right Azure subscription and tenant for the current repo before any az or Azure MCP call, and run App Insights / Log Analytics queries the way that actually returns rows. Use when the task mentions Azure, az, a subscription, App Insights, Log Analytics, Kusto/KQL, container apps, or "the logs" for a client app. Reads the org's profile for the subscription map; asks when the profile has none.
- **envlock** — Environment lock for shared dev resources (ports, database, containers) that a worktree can't isolate on its own. Use before starting a dev server, Aspire host, or anything the profile's env.launch patterns match, and when a launch is denied with "run: envlock acquire".
