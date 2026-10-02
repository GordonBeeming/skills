# core

Gordon's always-on workflow set for Codex: /work (plan, build, verify, PR with an autonomy dial), /review (PR and branch review with a depth dial), /skill-fix, the azure context skill, git-usage, envlock, and the cross-agent runners.

## Install

### Codex

```bash
codex plugin add core@gordon-codex-skills
```

## Skills

- **work** — Plan, build, verify, and open a PR for a piece of work, with an autonomy dial that says which
- **review** — Review code at a chosen depth, report the findings first, and post back only what User then chooses. Explicit slash only: runs when
- **pr** — Take the current worktree's changes to a pull request and, if asked, through to merge: commit,
- **azure** — Set the right Azure subscription and tenant for the current repo before any az or Azure MCP call, and run App Insights / Log Analytics queries the way that actually returns rows. Use when the task mentions Azure, az, a subscription, App Insights, Log Analytics, Kusto/KQL, container apps, or "the logs" for a client app. Reads the org's profile for the subscription map; asks when the profile has none.
- **envlock** — Environment lock for shared dev resources (ports, database, containers) that a worktree can't isolate on its own. Use before starting a dev server, Aspire host, or anything the profile's env.launch patterns match, and when a launch is denied with "run: envlock acquire".
- **cross-agent** — Decide when a $work or $review teammate row should be Claude or Antigravity instead of native Codex, and how to call claude-run.sh / agy-run.sh and read their report files. Use whenever $work or $review composes a team that includes a claude or agy worker, or a task explicitly asks to run something in Claude or Antigravity. Not a standalone user-facing workflow; the runner scripts are the mechanics, this skill is the routing and report-shape reference.
